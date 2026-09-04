# =============================================================================
# variables.tf — every input, and nothing hardcoded
# =============================================================================
#
# RULE FOR THIS FILE: no project id, region, token, password or account
# identifier is ever written into a resource. Everything lands here first, and
# anything secret is `sensitive = true` and carries NO default, so Terraform
# refuses to run rather than silently using a placeholder.
#
# Supply them by copying terraform.tfvars.example -> terraform.tfvars (which is
# gitignored), or by exporting TF_VAR_<name> — which is what CI does, so that no
# secret is ever written to a file on the runner.

# -----------------------------------------------------------------------------
# Naming
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Short slug prefixed onto every created resource. Lowercase letters, digits and hyphens."
  type        = string
  default     = "ecotrack"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.project_name))
    error_message = "project_name must be 2-21 chars, start with a letter, and contain only lowercase letters, digits and hyphens."
  }
}

variable "environment" {
  description = "Deployment environment. Becomes part of resource names and labels."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

# -----------------------------------------------------------------------------
# GCP — account and location
# -----------------------------------------------------------------------------

variable "gcp_project_id" {
  description = "The GCP project id (NOT the display name) that owns every resource here. No default: naming the wrong project is the one mistake Terraform cannot undo for you."
  type        = string
}

variable "gcp_region" {
  description = "Region for Cloud Run, Cloud SQL, Artifact Registry and the VPC subnet. europe-west1 (Belgium) is the nearest region with full Cloud Run + Cloud SQL support for a Romanian user base; europe-central2 (Warsaw) is closer still if it carries the services you need."
  type        = string
  default     = "europe-west1"
}

variable "gcp_zone" {
  description = "Default zone inside gcp_region. Nothing in main.tf is currently zonal; it is set so that adding a zonal resource later does not require a provider change."
  type        = string
  default     = "europe-west1-b"
}

variable "gcp_credentials_json" {
  description = "Raw JSON of a GCP service-account key. Leave empty locally to use Application Default Credentials (`gcloud auth application-default login`); CI passes the GCP_CREDENTIALS_JSON secret here."
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_apis" {
  description = "Whether Terraform should enable the required GCP service APIs. Leave true on a fresh project. Set false if your org enables APIs centrally and the deployer identity may not call serviceusage."
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Artifact Registry
# -----------------------------------------------------------------------------

variable "artifact_repository_id" {
  description = "Name of the Artifact Registry Docker repository that holds backend images."
  type        = string
  default     = "backend"
}

variable "artifact_keep_recent_count" {
  description = "How many recent backend images to keep. Older versions are deleted by a cleanup policy, because Artifact Registry storage is billed and a per-commit tag pushes a new image on every deploy."
  type        = number
  default     = 10
}

# -----------------------------------------------------------------------------
# Cloud SQL (PostgreSQL)
# -----------------------------------------------------------------------------

variable "db_name" {
  description = "Name of the application database created inside the instance. Reaches the backend as DB_NAME."
  type        = string
  default     = "ecotrack"
}

variable "db_user" {
  description = "Application database user. Reaches the backend as DB_USER. Not the `postgres` superuser — this account owns only the application database."
  type        = string
  default     = "ecotrack"
}

variable "db_password" {
  description = "Password for db_user. LEAVE EMPTY (the default) and Terraform generates a 32-character one, stores it in Secret Manager and never prints it. Set it only if you must match an existing password."
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_version" {
  description = "Cloud SQL Postgres engine version."
  type        = string
  default     = "POSTGRES_16"
}

variable "db_tier" {
  description = "Cloud SQL machine type. db-f1-micro is the cheapest thing that runs; it is shared-core and NOT covered by the Cloud SQL SLA. Move to db-custom-1-3840 or larger before real traffic."
  type        = string
  default     = "db-f1-micro"
}

variable "db_disk_size_gb" {
  description = "Initial disk size in GB. Storage auto-resizes upward and never shrinks, so start small."
  type        = number
  default     = 10
}

variable "db_availability_type" {
  description = "ZONAL (single zone, cheapest) or REGIONAL (synchronous standby, roughly double the cost). REGIONAL is the right answer once this holds real customer data."
  type        = string
  default     = "ZONAL"

  validation {
    condition     = contains(["ZONAL", "REGIONAL"], var.db_availability_type)
    error_message = "db_availability_type must be ZONAL or REGIONAL."
  }
}

variable "db_backup_retention_days" {
  description = "How many days of automated backups to retain."
  type        = number
  default     = 7
}

variable "db_deletion_protection" {
  description = "Blocks `terraform destroy` (and console deletion) of the SQL instance. Keep true anywhere with data you cannot recreate — the backend runs ddl-auto=update and there is no migration tool, so a dropped instance is a dropped schema."
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------
# Cloud SQL gets a PRIVATE IP only, and Cloud Run reaches it over direct VPC
# egress. That is what lets the backend keep its stock JDBC URL
# (jdbc:postgresql://$${DB_HOST}:$${DB_PORT}/$${DB_NAME}, see
# backend/src/main/resources/application-prod.properties) — the Cloud SQL Auth
# proxy would hand it a unix socket, which the plain Postgres JDBC driver
# cannot dial.

variable "vpc_subnet_cidr" {
  description = "CIDR for the subnet Cloud Run egresses through. Must not overlap vpc_private_services_cidr."
  type        = string
  default     = "10.8.0.0/24"
}

variable "vpc_private_services_cidr" {
  description = "Base address of the /16 reserved for Google-managed services — this is where the Cloud SQL private IP is allocated from."
  type        = string
  default     = "10.9.0.0"
}

# -----------------------------------------------------------------------------
# Cloud Run (backend API)
# -----------------------------------------------------------------------------

variable "backend_service_name" {
  description = "Cloud Run service name for the Spring Boot API."
  type        = string
  default     = "backend"
}

variable "backend_image" {
  description = "Full image ref Cloud Run should start. The default is a Google placeholder so the FIRST apply succeeds before any image exists — the real image is pushed by CI, which then calls `gcloud run deploy --image`. Terraform ignores later changes to this field on purpose (see main.tf)."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "backend_container_port" {
  description = "Port the container listens on. The backend's Dockerfile EXPOSEs 8080 and Spring Boot defaults to it."
  type        = number
  default     = 8080
}

variable "backend_cpu" {
  description = "CPU per instance. A JVM wants a full core to start in reasonable time."
  type        = string
  default     = "1"
}

variable "backend_memory" {
  description = "Memory per instance. The Dockerfile sets MaxRAMPercentage=75, so the heap follows this number."
  type        = string
  default     = "1Gi"
}

variable "backend_min_instances" {
  description = "Instances kept warm. MUST BE >= 1: the backend has two nightly @Scheduled jobs, and Cloud Run runs no code when it has scaled to zero. See the block comment above this variable before lowering it."
  type        = number

  # NOT a performance setting, and not scale-to-zero's usual cost trade.
  #
  # `RecurringTaskScheduler.generateUpcomingTasks` runs at 02:00 and is what
  # tops up indefinite Igienizare plans; `TokenService.pruneStaleSessions` runs
  # at 03:30. Both are Spring `@Scheduled` methods — they need a JVM that is
  # alive and holding CPU at that moment.
  #
  # At 0, Cloud Run has no instance at 02:00 (nobody uses the app at night) and
  # the jobs simply never run. Nothing errors and nothing is logged, because no
  # code executes; the first sign is a recurring plan quietly running out of
  # tasks. The single always-on container this deployment replaced had no such
  # failure mode, which is exactly why it is easy to miss in the move.
  #
  # 1 also flips `cpu_idle` to false in main.tf, so the instance keeps CPU
  # between requests — a throttled instance would not reliably fire a timer
  # either. Cost is roughly $10-15/month, and it removes the JVM cold start on
  # the first request as a side effect.
  #
  # The cheaper alternative, not built: scale to zero and drive both jobs from
  # Cloud Scheduler against an authenticated endpoint. That needs an endpoint,
  # a role-matrix row and an OIDC invoker — see TODO-80.
  default = 1

  validation {
    condition     = var.backend_min_instances >= 1
    error_message = "backend_min_instances must be at least 1, or the nightly schedulers never run. Read the comment above this variable — if you genuinely want scale-to-zero, the schedulers have to move to Cloud Scheduler first (TODO-80)."
  }
}

variable "backend_max_instances" {
  description = "Upper bound on concurrent instances. Also a cost ceiling, and a ceiling on Cloud SQL connections: each instance opens its own Hikari pool."
  type        = number
  default     = 4
}

variable "backend_allow_public_access" {
  description = "Grant roles/run.invoker to allUsers. Required as long as the browser calls the API directly — the Vercel frontend is a static SPA, so its fetches come from the visitor, not from a server that could hold a token."
  type        = bool
  default     = true
}

variable "spring_profiles_active" {
  description = "SPRING_PROFILES_ACTIVE for the container. `prod` is what selects application-prod.properties and therefore Postgres."
  type        = string
  default     = "prod"
}

variable "backend_env" {
  description = "Extra NON-SECRET environment variables for the backend container, e.g. { ECOTRACK_SECURITY_ENFORCE = \"true\" }. Values land in plaintext in the Cloud Run revision — anything credential-shaped belongs in backend_secrets."
  type        = map(string)
  default     = {}
}

variable "backend_secrets" {
  description = "Extra SECRET environment variables, e.g. { DO_SPACES_SECRET_KEY = \"...\" }. Each key becomes its own Secret Manager secret, and Cloud Run reads it at start through the runtime service account. Values are never echoed by an output."
  type        = map(string)
  default     = {}
  sensitive   = true
}

# -----------------------------------------------------------------------------
# IAM
# -----------------------------------------------------------------------------

variable "deployer_extra_roles" {
  description = "Additional project-level roles for the CI deployer service account. Empty by default so the deployer can only push images and roll revisions. Grant more only if you decide CI should also run `terraform apply` — that needs roles/cloudsql.admin, roles/secretmanager.admin, roles/iam.serviceAccountAdmin, roles/resourcemanager.projectIamAdmin, roles/compute.networkAdmin, roles/run.admin and roles/serviceusage.serviceUsageAdmin, which together are close to project owner. infra/README.md explains the trade-off."
  type        = list(string)
  default     = []
}

variable "create_deployer_key" {
  description = "Create and export a JSON key for the CI deployer service account. Default false, deliberately: a key here is written to Terraform state IN PLAINTEXT and never expires. Prefer Workload Identity Federation (infra/README.md has the setup). Flip true only to bootstrap the GCP_CREDENTIALS_JSON secret, then plan to rotate."
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Vercel (frontend)
# -----------------------------------------------------------------------------

variable "vercel_api_token" {
  description = "Vercel API token, from https://vercel.com/account/tokens. No default — the provider cannot authenticate without it."
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Vercel team id (team_xxx) when the project belongs to a Team. Leave empty for a personal account."
  type        = string
  default     = ""
}

variable "vercel_project_name" {
  description = "Name of the Vercel project holding the web/ SPA."
  type        = string
  default     = "ecotrack-web"
}

variable "vercel_git_repository" {
  description = "GitHub repo as \"owner/name\" to connect for automatic deploys, e.g. \"dantze/Dami-Prod-EcoTrack\". Leave empty to create the project unconnected — Terraform can attach it later, and the CI workflow can deploy without it."
  type        = string
  default     = ""
}

variable "vercel_production_branch" {
  description = "Branch Vercel treats as production. Ignored when vercel_git_repository is empty."
  type        = string
  default     = "main"
}

variable "web_root_directory" {
  description = "Path within the monorepo that Vercel builds. This is a monorepo, so it is NOT the repo root."
  type        = string
  default     = "web"
}

variable "web_install_command" {
  description = "Install step. `npm ci` is correct here — package-lock.json is committed."
  type        = string
  default     = "npm ci"
}

variable "web_build_command" {
  description = "Build step. `npm run build` also runs the prebuild hook that fetches the OCR assets, which needs network on a cold cache (see CLAUDE.md)."
  type        = string
  default     = "npm run build"
}

variable "web_output_directory" {
  description = "Directory Vercel serves after the build. Vite writes dist/."
  type        = string
  default     = "dist"
}

variable "web_custom_domains" {
  description = "Custom domains to attach to the Vercel project, e.g. [\"app.example.ro\"]. DNS still has to point at Vercel; Terraform only claims the domain on the project."
  type        = list(string)
  default     = []
}

variable "web_data_mode" {
  description = "VITE_DATA_MODE for the deployed frontend. `live` selects src/api/live; `mock` builds the in-memory store and never calls the backend. Production is live."
  type        = string
  default     = "live"

  validation {
    condition     = contains(["live", "mock"], var.web_data_mode)
    error_message = "web_data_mode must be live or mock."
  }
}
