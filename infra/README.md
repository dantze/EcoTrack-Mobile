# infra/ — Terraform for the GCP + Vercel deployment

Scaffolding for a **second** deployment target. Nothing here is live yet, and
nothing here touches the existing one.

| | Today (`deploy.yml`, live) | Here (`deploy-cloud.yml`) |
|---|---|---|
| Backend | Docker on a VPS | Cloud Run |
| Database | Postgres container on the same VPS | Cloud SQL |
| Frontend | Nginx container, same box | Vercel |
| TLS + routing | Caddy, one domain for both | Google-managed cert + Vercel |
| Origins | **one** — `/api` is same-origin | **two** — CORS is load-bearing |

That last row is the difference that reaches application code. On the VPS the
SPA fetches a relative `/api` and the browser never performs a cross-origin
check. Split across two clouds it does, so `ECOTRACK_CORS_ALLOWED_ORIGINS` on
the backend must name the Vercel origin. `main.tf` computes and sets it; if you
rename the Vercel project without applying, the frontend breaks with a CORS
error and a backend that looks perfectly healthy.

## Files

| File | Holds |
|---|---|
| `providers.tf` | Provider versions and auth. Also the four-line GCS backend block you will need. |
| `variables.tf` | Every input. Nothing sensitive has a default. |
| `main.tf` | All resources. |
| `outputs.tf` | What a human and the CI workflow read back. |
| `terraform.tfvars.example` | Template — copy to `terraform.tfvars`, which is gitignored. |

## State of this directory

`terraform fmt`, `terraform init -backend=false` and `terraform validate` pass.
The providers they resolved — google 6.50.0, vercel 3.17.0, random 3.9.0 — are
pinned in `.terraform.lock.hcl`, which **is committed**, with hashes recorded
for `linux_amd64` as well as `windows_amd64` and `darwin_arm64`. That matters:
a lock file carrying only Windows hashes makes `terraform init` fail on the
Ubuntu CI runner. Re-record them after adding a provider:

```bash
terraform providers lock -platform=windows_amd64 -platform=linux_amd64 -platform=darwin_arm64
```

Validation is not the same as working. Nothing here has been applied, no `plan`
has run against a real API, and the first one will surface things only the
provider can know — quota, region availability, an org policy.

## First run

You need the `gcloud` CLI, Terraform ≥ 1.6, a GCP project **with billing
enabled**, and a Vercel account.

```bash
gcloud auth application-default login       # no key file on your disk
gcloud config set project <your-project-id>

cd infra
cp terraform.tfvars.example terraform.tfvars
# fill in gcp_project_id and vercel_api_token

terraform init
terraform plan          # read it. It creates ~25 resources and starts billing.
terraform apply
```

The first apply takes **15–25 minutes**, nearly all of it the Cloud SQL
instance. It also enables eight service APIs, which can make the very first
plan fail with `API has not been used in project … before` — rerun it once the
enable has propagated.

Afterwards:

```bash
terraform output summary
gcloud secrets versions access latest \
  --secret="$(terraform output -raw database_password_secret_id)"
```

Cloud Run starts on a Google placeholder image (`cloudrun/container/hello`), not
the backend — the real image does not exist until CI pushes one. That is
deliberate: it lets the infrastructure exist before the first build, and
`main.tf` marks the `image` field `ignore_changes` so a later `terraform apply`
never rolls a deployed revision back to the placeholder.

## Move the state before CI applies anything

`providers.tf` has **no backend block**, so `terraform.tfstate` is a local file.
That is fine for one person bootstrapping. It is wrong the moment
`deploy-cloud.yml` runs `apply`, because a GitHub runner starts with an empty
checkout: run 1 creates everything, run 2 sees empty state, tries to create it
all again, and fails on a dozen "already exists" errors — with no way to import
what run 1 made except by hand.

```bash
gcloud storage buckets create gs://<your-tf-state-bucket> \
  --location=europe-west1 --uniform-bucket-level-access
gcloud storage buckets update gs://<your-tf-state-bucket> --versioning
```

Then add the block `providers.tf` documents at the top, and
`terraform init -migrate-state`. The workflow prints a warning on every run
until you do.

## Credentials for CI, and the honest problem with them

Terraform creates two service accounts, each with the smallest role set that
does its job:

- **`<prefix>-run`** — what the Cloud Run container runs as. It can read its own
  secrets (granted per secret, not project-wide) and write logs and metrics.
  Nothing else. Notably it is *not* the default Compute Engine service account,
  which carries project-wide `roles/editor` — a container running as that can
  delete the database it talks to.
- **`<prefix>-deployer`** — for CI. `artifactregistry.writer` on **this
  repository only**, `run.developer` (deploy revisions, but not rewrite the
  service's IAM policy, so a stolen CI token cannot open the API to the world),
  and `serviceAccountUser` on the runtime account alone.

**The deployer cannot run `terraform apply`.** Creating SQL instances, service
accounts, IAM bindings and VPC peerings needs admin roles across most of the
project — roughly `cloudsql.admin` + `secretmanager.admin` +
`iam.serviceAccountAdmin` + `resourcemanager.projectIamAdmin` +
`compute.networkAdmin` + `run.admin` + `serviceusage.serviceUsageAdmin`, which
together is close to owner. Granting that to the identity that also builds
container images defeats the split.

Three honest options, best first:

1. **Apply from a laptop, let CI ship images.** Infrastructure changes rarely;
   images change every commit. Run the `terraform` job on pull requests for
   `plan` only and remove the `apply` step. `GCP_CREDENTIALS_JSON` then only
   ever holds the narrow deployer.
2. **A separate `terraform-admin` identity**, its key in a GitHub *environment*
   with required reviewers, so an apply needs a human click.
3. **`deployer_extra_roles`** — grant the deployer the admin roles above and
   accept that CI holds near-owner. Off by default; it is a decision, not a
   default.

### Prefer Workload Identity Federation over a key

`create_deployer_key = true` writes a never-expiring private key into
`terraform.tfstate` **in plaintext**, which makes the state file as sensitive as
the key. WIF issues short-lived tokens to this repo instead, with no key
anywhere:

```bash
gcloud iam workload-identity-pools create github --location=global
gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository \
  --attribute-condition="assertion.repository=='<owner>/<repo>'"

gcloud iam service-accounts add-iam-policy-binding \
  "$(terraform output -raw deployer_service_account)" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github/attribute.repository/<owner>/<repo>"
```

Keep the `--attribute-condition`: without it, **any** GitHub repository can mint
tokens for your service account. Then swap the two commented lines in
`deploy-cloud.yml`'s auth step for `credentials_json`.

## Costs

Roughly, `europe-west1`, defaults as written:

| | |
|---|---|
| Cloud SQL `db-f1-micro`, 10 GB, ZONAL | ~$9–12/mo, and it runs 24/7 whether or not anyone uses it |
| Cloud Run, `min_instances = 0` | ~$0 idle, then per request |
| Artifact Registry | ~$0.10/GB/mo, capped by the cleanup policy |
| VPC, Secret Manager | cents |
| Vercel Hobby | $0 |

Cloud SQL is the whole bill and cannot scale to zero. `db-f1-micro` is
shared-core and carries **no SLA** — fine for a first deploy, not for customers.

`terraform destroy` will refuse while `db_deletion_protection = true`. That is
the point: the backend runs `ddl-auto=update` with no migration tool, so a
destroyed instance is a destroyed schema.

## Things this scaffold does not do

- No monitoring, alerting or uptime check.
- No Cloud Armor / rate limiting in front of Cloud Run.
- No custom domain for the backend — the `*.run.app` URL is what Vercel gets.
- Nothing for `mobile/`; it deploys through EAS (`deploy-mobile.yml`) and would
  need `EXPO_PUBLIC_API_BASE_URL` repointed at the Cloud Run URL by hand.
- No DigitalOcean Spaces equivalent. Task photos still go to Spaces; pass the
  `DO_SPACES_*` values through `backend_env` / `backend_secrets`, or migrate to
  a GCS bucket, which is not scaffolded here.

Tracked as TODO-71.
