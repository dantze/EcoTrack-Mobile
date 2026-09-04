# =============================================================================
# main.tf — GCP backend + database, Vercel frontend
# =============================================================================
#
# Shape of the thing:
#
#   Vercel (static SPA, web/)  --HTTPS-->  Cloud Run (Spring Boot, backend/)
#           ^                                        |
#           | VITE_API_BASE_URL injected below       | private IP, VPC egress
#           | from the Cloud Run URL                 v
#           +--------------------------------  Cloud SQL (Postgres)
#
#   Artifact Registry holds the backend image; Secret Manager holds the
#   database password and any other credential the container needs.
#
# THIS IS THE DEPLOYMENT. `.github/workflows/deploy.yml` applies it. It replaced
# an SSH-to-a-droplet workflow that ran backend + web + Postgres + Caddy as one
# docker compose stack; `docker-compose.yml` and the `Caddyfile` are the local
# development environment now and are deployed nowhere.
#
# Two consequences of the move that the application can feel, both handled
# below and both easy to undo by accident:
#
#   CORS. Caddy served the SPA and the API from ONE origin, so the browser's
#   API call was same-origin and CORS never applied. Vercel and Cloud Run are
#   two origins, so ECOTRACK_CORS_ALLOWED_ORIGINS is computed here and set on
#   the service. Get it wrong and both halves report themselves healthy while
#   every call between them is refused.
#
#   SCHEDULERS. The droplet ran one always-on container, so the backend's two
#   nightly @Scheduled jobs always fired. Cloud Run runs no code at zero
#   instances, so `backend_min_instances` is validated >= 1 and `cpu_idle`
#   follows it — see the comment on that variable.

locals {
  # Every resource name starts with this, so a second environment in the same
  # GCP project cannot collide with the first.
  prefix = "${var.project_name}-${var.environment}"

  labels = {
    application = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }

  # Generated unless the operator supplied one. Referenced only through this
  # local, so no resource has to know which of the two it got.
  db_password = var.db_password != "" ? var.db_password : random_password.db[0].result

  # The origins the SPA will be served from. Computed from the Vercel PROJECT
  # NAME rather than read off vercel_project.web, on purpose: the Vercel project
  # reads the Cloud Run URL, so reading a Vercel attribute back into Cloud Run
  # would be a dependency cycle Terraform refuses to plan. Vercel's production
  # alias is deterministically <project-name>.vercel.app, so nothing is lost.
  frontend_origins = concat(
    ["https://${var.vercel_project_name}.vercel.app"],
    [for d in var.web_custom_domains : "https://${d}"],
  )

  # var.backend_env wins on a key collision, so an operator can override the
  # computed CORS list without editing this file.
  backend_plain_env = merge(
    {
      ECOTRACK_CORS_ALLOWED_ORIGINS = join(",", local.frontend_origins)
    },
    var.backend_env,
  )

  # for_each cannot take a value marked sensitive, and var.backend_secrets is.
  # The KEYS are not secret — only the values — so unmarking just the key set is
  # correct here, and the values below stay sensitive.
  backend_secret_keys = nonsensitive(toset(keys(var.backend_secrets)))
}

# -----------------------------------------------------------------------------
# Service APIs
# -----------------------------------------------------------------------------
# A fresh GCP project has almost everything switched off; the first apply fails
# with "API has not been used in project ... before or it is disabled" without
# this. disable_on_destroy = false so that `terraform destroy` does not turn off
# an API something else in the project may be relying on.

resource "google_project_service" "required" {
  for_each = var.enable_apis ? toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
  ]) : toset([])

  project            = var.gcp_project_id
  service            = each.value
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# Artifact Registry — where backend images live
# -----------------------------------------------------------------------------

resource "google_artifact_registry_repository" "backend" {
  location      = var.gcp_region
  repository_id = "${local.prefix}-${var.artifact_repository_id}"
  description   = "Docker images for the ${var.project_name} Spring Boot backend"
  format        = "DOCKER"
  labels        = local.labels

  # CI tags every image with the commit SHA, so without a policy this grows
  # without bound and is billed by the GB. KEEP is evaluated before DELETE, so
  # the newest N survive the age rule.
  cleanup_policies {
    id     = "keep-recent-releases"
    action = "KEEP"
    most_recent_versions {
      keep_count = var.artifact_keep_recent_count
    }
  }

  cleanup_policies {
    id     = "delete-stale"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }

  depends_on = [google_project_service.required]
}

# -----------------------------------------------------------------------------
# Network — a private path from Cloud Run to Cloud SQL
# -----------------------------------------------------------------------------
# Cloud SQL is given NO public IP. Cloud Run reaches it over direct VPC egress,
# so the database's address is an ordinary host:port on a private network.
#
# This is the whole reason for the VPC: the Cloud SQL Auth proxy (the usual
# Cloud Run answer) presents the database as a UNIX SOCKET under /cloudsql, and
# the plain Postgres JDBC driver cannot dial one. The backend builds
# jdbc:postgresql://HOST:PORT/NAME from env vars and has no socket factory on
# its classpath, so giving it a real IP is what lets it deploy unmodified.

resource "google_compute_network" "vpc" {
  name                    = "${local.prefix}-vpc"
  auto_create_subnetworks = false
  description             = "Private network joining Cloud Run to Cloud SQL"

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "run" {
  name          = "${local.prefix}-run-subnet"
  region        = var.gcp_region
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.vpc_subnet_cidr

  # Lets the service reach Google APIs (Secret Manager, Artifact Registry,
  # Cloud Logging) without a NAT gateway or an external address.
  private_ip_google_access = true
}

# The /16 that Google's managed services allocate their private addresses from.
# Cloud SQL's private IP comes out of this range.
resource "google_compute_global_address" "private_services" {
  name          = "${local.prefix}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  address       = var.vpc_private_services_cidr
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]

  # Deleting the peering while a Cloud SQL instance still hangs off it fails and
  # leaves the destroy half-done; ABANDON removes it from state instead.
  deletion_policy = "ABANDON"

  depends_on = [google_project_service.required]
}

# -----------------------------------------------------------------------------
# Cloud SQL — PostgreSQL
# -----------------------------------------------------------------------------

resource "random_password" "db" {
  count = var.db_password == "" ? 1 : 0

  length  = 32
  special = true
  # Cloud SQL accepts more than this, but a password that survives being pasted
  # into a shell, a JDBC URL and a YAML file is worth more than four extra bits.
  override_special = "-_=+.~"
}

resource "google_sql_database_instance" "postgres" {
  name             = "${local.prefix}-postgres"
  database_version = var.db_version
  region           = var.gcp_region

  # Guards the instance against `terraform destroy` AND against deletion from
  # the console. The backend runs ddl-auto=update with no migration tool, so a
  # destroyed instance is an unrecoverable schema, not an inconvenience.
  deletion_protection = var.db_deletion_protection

  settings {
    tier              = var.db_tier
    availability_type = var.db_availability_type
    disk_size         = var.db_disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true
    user_labels       = local.labels

    ip_configuration {
      # No public IP at all: the only route in is the peered VPC.
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id

      # ssl_mode is deliberately left at its default
      # (ALLOW_UNENCRYPTED_AND_ENCRYPTED). Setting ENCRYPTED_ONLY is stricter
      # and reasonable on a private network, but the backend's JDBC URL carries
      # no ssl parameters — tighten this only together with
      # application-prod.properties, or the first boot fails to connect.
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00" # UTC, and clear of RecurringTaskScheduler's 02:00 local run
      point_in_time_recovery_enabled = true

      backup_retention_settings {
        retained_backups = var.db_backup_retention_days
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7 # Sunday
      hour         = 3
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled = true
    }
  }

  # The peering must exist before an instance can be given a private address.
  depends_on = [
    google_service_networking_connection.private_vpc,
    google_project_service.required,
  ]
}

resource "google_sql_database" "app" {
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = local.db_password
}

# -----------------------------------------------------------------------------
# Secret Manager — the database password, and anything else credential-shaped
# -----------------------------------------------------------------------------
# Only DB_PASS goes through Secret Manager; DB_USER, DB_NAME and DB_HOST are
# plain env vars. That is not an oversight — a username is not a credential, and
# putting it in a secret buys nothing while making the Cloud Run revision harder
# to read. The password is the thing that must never appear in a revision spec,
# in `gcloud run services describe`, or in a log line.

resource "google_secret_manager_secret" "db_password" {
  secret_id = "${local.prefix}-db-password"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = local.db_password
}

# One secret per entry in var.backend_secrets — DO_SPACES_SECRET_KEY,
# ECOTRACK_SETUP_CODE, and anything else the container must read but must not
# carry in plaintext.
resource "google_secret_manager_secret" "backend" {
  for_each = local.backend_secret_keys

  secret_id = "${local.prefix}-${lower(replace(each.key, "_", "-"))}"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "backend" {
  for_each = local.backend_secret_keys

  secret      = google_secret_manager_secret.backend[each.key].id
  secret_data = var.backend_secrets[each.key]
}

# -----------------------------------------------------------------------------
# IAM — two identities, each with the smallest role set that works
# -----------------------------------------------------------------------------
# 1. backend_runtime — what the Cloud Run container runs AS.
# 2. deployer        — what CI uses to push an image and roll a revision.
#
# They are separate because they need disjoint powers: the runtime reads
# secrets and can do nothing else; the deployer writes images and rolls
# revisions and can read no secret. Cloud Run's DEFAULT service account is the
# Compute Engine one, which holds project-wide roles/editor — using it would
# hand the container the ability to delete the database it talks to.

resource "google_service_account" "backend_runtime" {
  account_id   = "${local.prefix}-run"
  display_name = "${var.project_name} Cloud Run runtime (${var.environment})"
  description  = "Identity the backend container runs as. Reads its own secrets; nothing else."

  depends_on = [google_project_service.required]
}

# Per-SECRET, not project-wide: this grant lets the container read exactly the
# database password, not every secret in the project.
resource "google_secret_manager_secret_iam_member" "runtime_db_password" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "runtime_backend_secrets" {
  for_each = local.backend_secret_keys

  secret_id = google_secret_manager_secret.backend[each.key].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend_runtime.email}"
}

# Structured logs and metrics from the container. A custom runtime service
# account does not inherit these the way the default one does.
resource "google_project_iam_member" "runtime_logging" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.gcp_project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.backend_runtime.email}"
}

# NOTE: roles/cloudsql.client is deliberately NOT granted. It is what the Cloud
# SQL Auth proxy needs, and this service connects over a private IP instead. Add
# it here (and only here) if you ever switch to the proxy.

resource "google_service_account" "deployer" {
  account_id   = "${local.prefix}-deployer"
  display_name = "${var.project_name} CI deployer (${var.environment})"
  description  = "Identity for GitHub Actions: pushes backend images and rolls Cloud Run revisions."

  depends_on = [google_project_service.required]
}

# Push rights on THIS repository only, rather than roles/artifactregistry.writer
# across the project.
resource "google_artifact_registry_repository_iam_member" "deployer_push" {
  location   = google_artifact_registry_repository.backend.location
  repository = google_artifact_registry_repository.backend.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deployer.email}"
}

# run.developer, not run.admin: it can deploy revisions and change traffic, but
# cannot rewrite the service's IAM policy — so a compromised CI token cannot
# quietly open the API to the world.
resource "google_project_iam_member" "deployer_run" {
  project = var.gcp_project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# Deploying a service that RUNS AS backend_runtime requires permission to act as
# it. Scoped to that one service account, not granted project-wide.
resource "google_service_account_iam_member" "deployer_act_as_runtime" {
  service_account_id = google_service_account.backend_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

# Escape hatch for the case described in infra/README.md: an identity that runs
# `terraform apply` in CI needs admin roles over SQL, IAM, networking and
# Secret Manager, which is a strictly larger grant than deploying an image.
# Empty by default so the deployer stays least-privilege until you decide
# otherwise.
resource "google_project_iam_member" "deployer_extra" {
  for_each = toset(var.deployer_extra_roles)

  project = var.gcp_project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# Off by default. A service-account key is a permanent credential, and creating
# one here writes it into terraform.tfstate IN PLAINTEXT — so the state file
# becomes as sensitive as the key. Workload Identity Federation avoids the key
# entirely; see infra/README.md.
resource "google_service_account_key" "deployer" {
  count = var.create_deployer_key ? 1 : 0

  service_account_id = google_service_account.deployer.name
}

# -----------------------------------------------------------------------------
# Cloud Run — the backend API
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "backend" {
  name     = "${local.prefix}-${var.backend_service_name}"
  location = var.gcp_region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = local.labels

  # Terraform-level guard, separate from the SQL one. The service is
  # reconstructible from this file, so it stays off.
  deletion_protection = false

  template {
    service_account                  = google_service_account.backend_runtime.email
    timeout                          = "300s"
    max_instance_request_concurrency = 80
    labels                           = local.labels

    scaling {
      min_instance_count = var.backend_min_instances
      max_instance_count = var.backend_max_instances
    }

    # Direct VPC egress. PRIVATE_RANGES_ONLY sends RFC1918 traffic (the
    # database) through the VPC and everything else straight out, so calls to
    # Spaces, OpenFreeMap and Photon do not need a NAT gateway.
    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"

      network_interfaces {
        network    = google_compute_network.vpc.id
        subnetwork = google_compute_subnetwork.run.id
      }
    }

    containers {
      image = var.backend_image

      ports {
        container_port = var.backend_container_port
      }

      resources {
        limits = {
          cpu    = var.backend_cpu
          memory = var.backend_memory
        }

        # CPU allocated between requests, which is what a Spring `@Scheduled`
        # method needs to fire at 02:00 — a throttled instance would not run
        # one. Tied to min_instances rather than hardcoded so the two cannot
        # disagree, and `backend_min_instances` is validated >= 1 for the same
        # reason (read its comment before changing either).
        cpu_idle          = var.backend_min_instances == 0
        startup_cpu_boost = true
      }

      env {
        name  = "SPRING_PROFILES_ACTIVE"
        value = var.spring_profiles_active
      }

      # The four halves of the JDBC URL that application-prod.properties builds.
      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.postgres.private_ip_address
      }

      env {
        name  = "DB_PORT"
        value = "5432"
      }

      env {
        name  = "DB_NAME"
        value = google_sql_database.app.name
      }

      env {
        name  = "DB_USER"
        value = google_sql_user.app.name
      }

      # The password is never written into the revision — Cloud Run resolves it
      # from Secret Manager at instance start, as backend_runtime.
      env {
        name = "DB_PASS"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = local.backend_plain_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.backend_secret_keys
        content {
          name = env.value
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.backend[env.value].secret_id
              version = "latest"
            }
          }
        }
      }

      # A cold JVM plus Hibernate's schema check is slow. 30 x 10s gives it five
      # minutes before Cloud Run calls the revision failed; without a startup
      # probe the default is far shorter and a scale-from-zero request 503s.
      startup_probe {
        initial_delay_seconds = 10
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 30

        http_get {
          path = "/actuator/health"
          port = var.backend_container_port
        }
      }

      liveness_probe {
        period_seconds    = 30
        timeout_seconds   = 5
        failure_threshold = 3

        http_get {
          path = "/actuator/health"
          port = var.backend_container_port
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    # THE IMPORTANT ONE. CI pushes a commit-tagged image and rolls it out with
    # `gcloud run deploy`; Terraform's copy of `image` is then stale by design.
    # Without this, the next `terraform apply` would roll production back to
    # var.backend_image — quietly, as a one-line diff nobody reads.
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_secret_manager_secret_version.db_password,
    google_secret_manager_secret_iam_member.runtime_db_password,
    google_project_service.required,
  ]
}

# The SPA is static: its API calls are made by the visitor's browser, which
# holds no Google identity, so the service has to accept unauthenticated
# callers. Authorization is the backend's own job — ecotrack.security.enforce
# defaults to true and every /api/** route sits behind the role matrix in
# SecurityConfig. Set backend_allow_public_access = false only if you put an
# authenticating proxy in front.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.backend_allow_public_access ? 1 : 0

  project  = google_cloud_run_v2_service.backend.project
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# -----------------------------------------------------------------------------
# Vercel — the frontend
# -----------------------------------------------------------------------------

resource "vercel_project" "web" {
  name      = var.vercel_project_name
  framework = "vite"

  # This is a monorepo: web/ is the app, the repo root is not.
  root_directory   = var.web_root_directory
  install_command  = var.web_install_command
  build_command    = var.web_build_command
  output_directory = var.web_output_directory

  # Only rebuild when web/ or the shared fixtures actually changed. Vercel runs
  # this against the repo root; exit 1 means build, exit 0 means skip.
  ignore_command = "git diff --quiet HEAD^ HEAD -- ${var.web_root_directory} shared"

  # Connected only if a repo was supplied. Leave var.vercel_git_repository empty
  # and the project exists without a git connection — deployable from CI, and
  # attachable later without recreating it.
  git_repository = var.vercel_git_repository != "" ? {
    type              = "github"
    repo              = var.vercel_git_repository
    production_branch = var.vercel_production_branch
  } : null
}

# -----------------------------------------------------------------------------
# THE JOIN: the frontend learns the backend's address from Terraform
# -----------------------------------------------------------------------------
# This is the one piece of wiring that makes the two clouds one system. The
# Cloud Run URL is not known until the service exists, so it cannot be typed
# into a .env file ahead of time — Terraform reads it off the resource and
# writes it into the Vercel project.
#
# Vite inlines VITE_* at BUILD time, not at run time. So a changed URL only
# reaches users after a Vercel redeploy; changing it here and stopping is not
# enough. The CI workflow triggers that redeploy.

resource "vercel_project_environment_variable" "api_base_url" {
  project_id = vercel_project.web.id
  key        = "VITE_API_BASE_URL"

  # The web client appends paths to this, and every backend route is under
  # /api — matching the relative "/api" the Caddy deployment uses.
  value  = "${google_cloud_run_v2_service.backend.uri}/api"
  target = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "data_mode" {
  project_id = vercel_project.web.id
  key        = "VITE_DATA_MODE"

  # src/api/index.ts reads this at build time to pick the live implementation
  # over the in-memory mock store. A deployed build that says "mock" is a
  # convincing app talking to nothing.
  value  = var.web_data_mode
  target = ["production", "preview", "development"]
}

resource "vercel_project_domain" "custom" {
  for_each = toset(var.web_custom_domains)

  project_id = vercel_project.web.id
  domain     = each.value
}
