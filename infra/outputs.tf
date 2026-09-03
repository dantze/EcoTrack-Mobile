# =============================================================================
# outputs.tf — what the rest of the pipeline needs to know
# =============================================================================
#
# Two audiences:
#   - a human, checking where things landed after the first apply;
#   - .github/workflows/deploy-cloud.yml, which reads `terraform output -raw`
#     to learn the registry host, the image path and the service name. Renaming
#     an output below means editing that workflow.
#
# Nothing here prints a credential. The database password is generated inside
# Terraform and lives in Secret Manager; the only way to see it is to ask Secret
# Manager, which is the point.

# -----------------------------------------------------------------------------
# Backend
# -----------------------------------------------------------------------------

output "backend_url" {
  description = "Public HTTPS URL of the Cloud Run backend. This is the value injected into Vercel as VITE_API_BASE_URL (with /api appended)."
  value       = google_cloud_run_v2_service.backend.uri
}

output "backend_api_base_url" {
  description = "Exactly what the frontend calls — the Cloud Run URL plus the /api prefix every backend route sits under."
  value       = "${google_cloud_run_v2_service.backend.uri}/api"
}

output "backend_service_name" {
  description = "Cloud Run service name. CI passes this to `gcloud run deploy`."
  value       = google_cloud_run_v2_service.backend.name
}

output "backend_region" {
  description = "Region the Cloud Run service and Cloud SQL instance live in."
  value       = var.gcp_region
}

# -----------------------------------------------------------------------------
# Artifact Registry
# -----------------------------------------------------------------------------

output "artifact_registry_host" {
  description = "Docker registry host to authenticate against, e.g. europe-west1-docker.pkg.dev. CI feeds this to `gcloud auth configure-docker`."
  value       = "${var.gcp_region}-docker.pkg.dev"
}

output "backend_image_repository" {
  description = "Full image path WITHOUT a tag. CI appends :<commit-sha> and :latest."
  value       = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.backend.repository_id}/${var.backend_service_name}"
}

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

output "database_instance_name" {
  description = "Cloud SQL instance name."
  value       = google_sql_database_instance.postgres.name
}

output "database_connection_name" {
  description = "project:region:instance — what the Cloud SQL Auth proxy takes, and how you reach the instance from a laptop (`gcloud sql connect`, or `cloud-sql-proxy <this>`). The instance has no public IP, so this is the only route in from outside the VPC."
  value       = google_sql_database_instance.postgres.connection_name
}

output "database_private_ip" {
  description = "The private address Cloud Run connects to, i.e. DB_HOST inside the container. Unreachable from the internet by design."
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "database_password_secret_id" {
  description = "Secret Manager secret holding the database password. Read it with: gcloud secrets versions access latest --secret=<this>. The password itself is never an output."
  value       = google_secret_manager_secret.db_password.secret_id
}

# -----------------------------------------------------------------------------
# Identities
# -----------------------------------------------------------------------------

output "backend_runtime_service_account" {
  description = "Service account the Cloud Run container runs as."
  value       = google_service_account.backend_runtime.email
}

output "deployer_service_account" {
  description = "Service account for CI. Bind your GitHub Workload Identity pool to this, or issue it a key (see create_deployer_key)."
  value       = google_service_account.deployer.email
}

output "deployer_service_account_key" {
  description = "Base64 JSON key for the deployer, only when create_deployer_key = true. Decode and paste into the GCP_CREDENTIALS_JSON GitHub secret: terraform output -raw deployer_service_account_key | base64 -d. Null otherwise."
  value       = var.create_deployer_key ? google_service_account_key.deployer[0].private_key : null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Frontend
# -----------------------------------------------------------------------------

output "vercel_project_id" {
  description = "Vercel project id. CI passes it to the Vercel CLI as VERCEL_PROJECT_ID."
  value       = vercel_project.web.id
}

output "vercel_project_name" {
  description = "Vercel project name."
  value       = vercel_project.web.name
}

output "frontend_url" {
  description = "Vercel's production alias for the project. A custom domain in web_custom_domains serves the same deployment."
  value       = "https://${vercel_project.web.name}.vercel.app"
}

output "frontend_allowed_origins" {
  description = "Origins written into the backend's ECOTRACK_CORS_ALLOWED_ORIGINS. Unlike the VPS deployment, the SPA and the API are on different origins here, so this list is what stands between the frontend and a browser-blocked fetch."
  value       = local.frontend_origins
}

# -----------------------------------------------------------------------------
# One-glance summary
# -----------------------------------------------------------------------------

output "summary" {
  description = "Everything you need after the first apply, in one place."
  value = {
    frontend           = "https://${vercel_project.web.name}.vercel.app"
    backend            = google_cloud_run_v2_service.backend.uri
    api_base_url       = "${google_cloud_run_v2_service.backend.uri}/api"
    image_repository   = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.backend.repository_id}/${var.backend_service_name}"
    database           = google_sql_database_instance.postgres.connection_name
    db_password_secret = google_secret_manager_secret.db_password.secret_id
    runtime_identity   = google_service_account.backend_runtime.email
    deployer_identity  = google_service_account.deployer.email
  }
}
