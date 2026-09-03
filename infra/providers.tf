# =============================================================================
# providers.tf — provider requirements and configuration
# =============================================================================
#
# STATE IS LOCAL, ON PURPOSE (for now).
# There is no `backend` block, so `terraform.tfstate` is written next to these
# files and is gitignored (see infra/.gitignore). That is fine for one person
# bootstrapping an account. It stops being fine the moment CI runs `apply`:
# a GitHub Actions runner starts with an EMPTY working directory, so a local
# state file means every run believes nothing exists and tries to create it all
# again. Before the workflow's apply job is switched on for real, move state to
# a GCS bucket:
#
#   terraform {
#     backend "gcs" {
#       bucket = "<your-tf-state-bucket>"
#       prefix = "ecotrack/infra"
#     }
#   }
#
# then `terraform init -migrate-state`. Nothing else in this directory changes.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }

    # Vercel's provider is published by Vercel, not HashiCorp.
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# -----------------------------------------------------------------------------
# Google Cloud
# -----------------------------------------------------------------------------
# Credentials resolve in this order:
#   1. var.gcp_credentials_json — the raw contents of a service-account key.
#      This is what CI passes, from the GCP_CREDENTIALS_JSON secret.
#   2. Application Default Credentials — what `gcloud auth application-default
#      login` leaves behind. This is what you want locally: leave the variable
#      empty and no key ever touches your disk.
# Passing "" (the default) makes the provider fall through to ADC.
provider "google" {
  project     = var.gcp_project_id
  region      = var.gcp_region
  zone        = var.gcp_zone
  credentials = var.gcp_credentials_json != "" ? var.gcp_credentials_json : null
}

# -----------------------------------------------------------------------------
# Vercel
# -----------------------------------------------------------------------------
# api_token is required and has no default — see variables.tf. team is optional:
# leave it null for a personal ("hobby") account, set it to a team id when the
# project lives under a Vercel Team.
provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id != "" ? var.vercel_team_id : null
}
