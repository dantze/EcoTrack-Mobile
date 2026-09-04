# Deployment

Backend on **Cloud Run**, database on **Cloud SQL** (PostgreSQL), frontend on
**Vercel**, all of it described by Terraform in `infra/`.

> **This replaced a single DigitalOcean droplet** running backend + web +
> Postgres + Caddy as one `docker compose` stack. That droplet is gone, and the
> workflow that deployed to it had been gated off since TODO-32. `docker-compose.yml`
> and the `Caddyfile` are still here and still work — they are the LOCAL
> full-stack environment now, and are deployed nowhere.

## Triggers

| Change | Do this | Result |
|---|---|---|
| `backend/**`, `web/**`, `shared/**` or `infra/**` | merge to `main` | Terraform applies, backend image ships to Cloud Run, Vercel rebuilds |
| `mobile/**` (JS only) | merge to `main` | OTA — apps update on next launch |
| `mobile/**` (native) | Actions → Deploy Mobile → `build-production` | Play Store bundle |

All gated on CI. Red tests = no deploy.

> **The deploy skips itself until the cloud secrets exist.** The first job,
> *Check cloud credentials*, looks for `GCP_CREDENTIALS_JSON`, `GCP_PROJECT_ID`,
> `VERCEL_API_TOKEN` and `VERCEL_ORG_ID`; if any is missing it posts a notice and
> every later job is skipped. The run is **green** — nothing is wrong with the
> commit, there is just nowhere to deploy to yet. Add the secrets and the same
> workflow starts deploying with no edit.

Native = new native module, SDK bump, plugin/permission change, or `expo.version`
bump. An OTA cannot carry those.

## The shape, and the one thing it changed

```
Vercel (static SPA, web/)  ──HTTPS──▶  Cloud Run (Spring Boot, backend/)
        ▲                                       │
        │ VITE_API_BASE_URL, written by         │ private IP, VPC egress
        │ Terraform from the Cloud Run URL      ▼
        └───────────────────────────────  Cloud SQL (PostgreSQL 16)
```

**Two origins, so CORS is load-bearing.** On the droplet, Caddy served the SPA
and proxied `/api` on one domain, so the browser's API call was same-origin and
CORS never applied. It applies now: `infra/main.tf` computes
`ECOTRACK_CORS_ALLOWED_ORIGINS` from the Vercel project name plus any custom
domains and sets it on the Cloud Run service.

That is the failure this deployment can produce that the old one could not — and
it is invisible from either side. Cloud Run answers `/actuator/health` happily,
Vercel serves the bundle happily, and the browser refuses every call between
them. **If the app loads but every list is empty, open the console before
anything else.** Renaming the Vercel project without re-applying Terraform is
the way to cause it.

The database has **no public IP**. Cloud Run reaches it over direct VPC egress,
which is why `infra/` creates a VPC at all — the Cloud SQL Auth proxy presents a
unix socket, and the plain Postgres JDBC driver the backend uses cannot dial one.
To reach it yourself, see *Getting a shell on the database* below.

## One-time setup

**1. Accounts.** A GCP project with **billing enabled**, and a Vercel account.
Cloud SQL is the whole bill and runs 24/7 whether or not anyone uses the app —
budget ~$10–15/month at the default `db-f1-micro`, which is shared-core and
carries **no SLA**. Vercel Hobby is free.

**2. Apply the infrastructure once, from a laptop.**

```bash
gcloud auth application-default login
gcloud config set project <your-project-id>

cd infra
cp terraform.tfvars.example terraform.tfvars   # gitignored
# fill in gcp_project_id and vercel_api_token

terraform init
terraform plan          # read it: ~25 resources, and it starts billing
terraform apply         # 15–25 min, nearly all of it Cloud SQL
terraform output summary
```

The first apply enables eight service APIs, so the very first `plan` can fail
with `API has not been used in project … before`. Re-run it once.

Cloud Run starts on a Google placeholder image, not the backend — the real image
does not exist until CI pushes one. That is deliberate, and `infra/main.tf`
marks the image field `ignore_changes` so a later `apply` never rolls a deployed
revision back to the placeholder.

**3. Move Terraform state to GCS before CI applies anything.** `infra/providers.tf`
ships with no backend block, so state is a local file. A GitHub runner starts
with an empty checkout: run 1 creates everything, run 2 sees empty state and
tries to create it all again. `infra/README.md` has the two commands and the
four-line block.

**4. GitHub → Settings → Secrets and variables → Actions → Secrets:**

```
GCP_CREDENTIALS_JSON   GCP_PROJECT_ID
VERCEL_API_TOKEN       VERCEL_ORG_ID
EXPO_TOKEN                       # expo.dev → Account → Access tokens
```

Optional:

```
VERCEL_TEAM_ID           # only if the Vercel project is under a Team
BACKEND_SECRETS_JSON     # {"DO_SPACES_ACCESS_KEY":"…","DO_SPACES_SECRET_KEY":"…"}
```

`BACKEND_SECRETS_JSON` is how credentials reach the container: each key becomes
its own Secret Manager secret, readable only by the Cloud Run runtime service
account. **Task photos still live in DigitalOcean Spaces**, so the `DO_SPACES_*`
values are still required for photo upload to work — moving them to GCS is not
done (TODO-79).

**Variables** (Settings → Variables, not secrets; defaults shown):

```
GCP_REGION=europe-west1        VERCEL_PROJECT_NAME=ecotrack-web
EXPO_PUBLIC_API_BASE_URL=      # the Cloud Run URL + /api — see below
```

**5. Read `infra/README.md` on who may run `terraform apply`.** The deployer
service account Terraform creates can push images and roll revisions and
nothing else. An identity that runs `apply` needs admin over SQL, IAM,
networking and Secret Manager — close to project owner. The recommendation is
option 1 there: apply from a laptop, let CI ship images only.

**6. Mobile.** Set `EXPO_PUBLIC_API_BASE_URL` to
`terraform output -raw backend_api_base_url` and rebuild. `EXPO_PUBLIC_*` is
inlined at build time, so installed binaries keep whatever they were built with
— and the ones in the field were built against the droplet (TODO-72).

**7. Custom domains** (optional). Add them to `web_custom_domains` in
`terraform.tfvars` and point DNS at Vercel. Terraform claims the domain on the
project and adds it to the backend's allowed CORS origins; it does not touch
DNS. The backend keeps its `*.run.app` URL — there is no custom domain for the
API.

## First enrolment

**There is no password and no sign-up.** The first access request on an empty
database becomes ADMIN, and it must carry a one-time code. Two ways to get one:

**A. Choose it up front (nothing to read from a log).** Put it in
`BACKEND_SECRETS_JSON` as `ECOTRACK_SETUP_CODE`, or in `backend_secrets` in
`terraform.tfvars`, before the first deploy.

```bash
openssl rand -base64 18        # 12 characters minimum, or it is IGNORED
```

It is **inert the moment one employee exists**, so it is not a standing
credential — but rotate it afterwards anyway, and never reuse it as the lockout
recovery code (it is not accepted as one).

**B. Read the generated one** (what happens when it is unset):

```bash
gcloud run services logs read "$(cd infra && terraform output -raw backend_service_name)" \
    --region "$(cd infra && terraform output -raw backend_region)" --limit 200 \
  | grep -A4 'First-run admin code'
```

Then: open the app → *Solicită acces* → name + the code → the device is ADMIN
immediately and everyone else's requests go to that admin for approval.

## Recovering when no admin can sign in

If the **last** admin logs out or loses their only device, nobody is left to
approve anything. The server detects this and logs a single-use recovery code:

```bash
gcloud run services logs read "$(cd infra && terraform output -raw backend_service_name)" \
    --region "$(cd infra && terraform output -raw backend_region)" --limit 200 \
  | grep -A6 'Admin recovery code'
```

Enter it on the access-request screen (the field is labelled *Cod de recuperare*
and only appears in this state) and it mints a **new** ADMIN. The old admin's
row survives with no sessions — delete it in Angajați afterwards if it is a
duplicate.

The code is minted when the state is first observed, so hit `/api/enrollment/status`
(just open the app) if nothing is in the log yet. It is **not** the same as
`ECOTRACK_SETUP_CODE`, which is deliberately not accepted here.

**Scale-to-zero note:** `backend_min_instances` is 0 by default, so an idle
service has no running instance and therefore no recent logs. Open the app once
to wake it before grepping.

## Rollback

Neither half rolls back by reverting a commit alone — both platforms keep the
previous version, and pointing at it is faster than a rebuild.

**Backend** — list revisions and send traffic to the previous one:

```bash
gcloud run revisions list --service <service> --region <region>
gcloud run services update-traffic <service> --region <region> --to-revisions <revision>=100
```

**Frontend** — Vercel dashboard → Deployments → the previous one → *Promote to
Production*. Instant; it is a served build, not a rebuild.

Then revert the commit so the next deploy does not re-ship it. Mobile OTA:
`eas update:republish --branch production`.

**There is no database rollback.** `ddl-auto=update` never drops anything, so a
schema change is not undone by deploying the old image. Cloud SQL keeps 7 days
of automated backups and point-in-time recovery — restoring is a `gcloud sql`
operation on the instance, not part of this pipeline.

## Getting a shell on the database

The instance has no public IP, so the Cloud SQL Auth proxy is the only way in
from outside the VPC:

```bash
cd infra
gcloud sql connect "$(terraform output -raw database_instance_name)" --user=ecotrack
# password:
gcloud secrets versions access latest --secret="$(terraform output -raw database_password_secret_id)"
```

## Local

Unchanged, and deliberately still one origin:

```bash
cp .env.example .env     # set DB_PASS
docker compose up -d --build
```
→ `https://localhost` (self-signed warning expected).

**This no longer resembles production, in one specific way.** Caddy serves the
SPA and proxies `/api` on the same host, so every API call is same-origin —
which means **a CORS misconfiguration cannot be reproduced locally**. That is
the one class of bug you have to find in a deployed environment. Everything
else — the backend, Postgres, the SPA, enrolment, photos — behaves the same.

For a two-origin local setup closer to production, run the backend from compose
and the frontend from Vite instead:

```bash
docker compose up -d --build postgres backend
cd web && VITE_DATA_MODE=live VITE_API_BASE_URL=http://localhost:8080/api npm run dev
```

That needs `ECOTRACK_CORS_ALLOWED_ORIGINS` to include `http://localhost:5173`,
which `.env.example` sets.

## Legacy ID photos — drained, and how to check anyway

EcoTrack no longer stores photographs of identity documents (TODO-14), and as of
TODO-45 nothing records that it once did: `Individual.idPhotoUrl`,
`IndividualRepository` and the `/api/admin/id-photos` purge endpoint are all
deleted. The owner confirmed no photos were ever uploaded — the app has not left
development — and no committed database ever held a single stored URL.

**One thing survives that deletion on purpose: the prefix.** ID photos were
written under **`persoane fizice/`, with the space** — recovered from
`PhotosController.clientIdsFolderName` before that class was deleted, and never
written down anywhere else. It is kept here because it is what makes the check
below possible now that the column is gone: an object can still be found by
prefix even though nothing in the database points at it. Task photos live under
a different prefix and must be left alone.

```bash
# DigitalOcean Spaces is S3-compatible; use the region endpoint from .env.
# Needs the Spaces keys and nothing else — no running server.
aws s3 ls "s3://$DO_SPACES_BUCKET/persoane fizice/" \
    --endpoint-url "https://$DO_SPACES_REGION.digitaloceanspaces.com" \
    --recursive --human-readable --summarize
```

Expected: nothing. **If it ever lists objects**, they are scans of identity
documents written with a public-read ACL — a working unauthenticated URL each —
and nothing in the application can find or delete them any more. Delete them
with the keys directly:

```bash
aws s3 rm "s3://$DO_SPACES_BUCKET/persoane fizice/" \
    --endpoint-url "https://$DO_SPACES_REGION.digitaloceanspaces.com" --recursive
```

### Dropping the column

`ddl-auto=update` never drops anything, so `individual.id_photo_url` outlives
the field that mapped it — in H2 and in Postgres, exactly like the orphaned
`intake_message` / `order_draft` tables from TODO-15. Nothing reads it and
nothing writes it, so this is tidiness rather than a fix. Per environment:

```sql
ALTER TABLE individual DROP COLUMN id_photo_url;
```

The local H2 file is `backend/data/damiprod`; the local Postgres is
`docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"`; Cloud SQL is
*Getting a shell on the database* above. Run the bucket check above first if it
has not been run for that environment — the column is the last thing that would
have told you which objects existed.

## Task photos are private (one-time ACL fix for old objects)

New uploads are written `PRIVATE` and served as short-lived presigned URLs
(TODO-46). **Objects uploaded by earlier builds keep the public-read ACL they
were created with** — changing the code does not re-ACL anything already in the
bucket, exactly like the ID photos in the section above.

They live under `poze cabine/`. Flip them once, per environment:

```bash
# what is there
aws s3 ls "s3://$DO_SPACES_BUCKET/poze cabine/" \
    --endpoint-url "https://$DO_SPACES_REGION.digitaloceanspaces.com" --recursive

# make each one private (no bulk flag exists; one call per object)
aws s3 ls "s3://$DO_SPACES_BUCKET/poze cabine/" \
    --endpoint-url "https://$DO_SPACES_REGION.digitaloceanspaces.com" --recursive \
  | awk '{ $1=""; $2=""; $3=""; sub(/^ +/, ""); print }' \
  | while IFS= read -r key; do
      aws s3api put-object-acl --bucket "$DO_SPACES_BUCKET" --key "$key" --acl private \
          --endpoint-url "https://$DO_SPACES_REGION.digitaloceanspaces.com"
    done
```

Do this **after** the release that adds presigning, not before: until it is
deployed, the app still hands clients raw URLs, and making the objects private
first would show drivers broken images.

## Gotchas

- `ECOTRACK_SECURITY_ENFORCE=true` logs out every device on a pre-token build.
  Ship mobile, confirm rollout, *then* flip.
- `VITE_*` / `EXPO_PUBLIC_*` are **build-time**. Changing one needs a rebuild.
- `runtimeVersion` is `appVersion`: bumping `expo.version` fences OTAs off from
  older installs until they get a new binary. Intentional.
- No DB migrations (`ddl-auto=update`). Destructive schema changes are manual,
  and `db_deletion_protection` in `infra/` is what stops `terraform destroy`
  taking the schema with it. Keep it `true`.
- The web build downloads the ID scanner's language model once, from a pinned
  `tessdata_fast` tag, verified against a SHA-256 in
  `web/scripts/fetch-ocr-assets.mjs`. **A web build needs network for that**, and
  fails loudly rather than shipping a scanner with no model. This runs on
  Vercel's builder now, not in a Docker image.
- **`backend_min_instances` is 1 and must stay ≥ 1.** Not a performance
  setting: the backend runs two nightly `@Scheduled` jobs (recurring-task
  top-up at 02:00, session prune at 03:30), and Cloud Run runs no code when it
  has scaled to zero — at 02:00 there is no traffic, so the jobs would simply
  never fire, with nothing logged because nothing executes. The always-on
  container this replaced had no such failure mode. Terraform refuses a value
  below 1; TODO-80 is the cheaper alternative (Cloud Scheduler) if the
  ~$10–15/month matters.
- **Do not raise `backend_max_instances` casually.** Those `@Scheduled` jobs
  run on *every* instance, so at 02:00 with more than one alive the recurring
  top-up runs more than once concurrently, and nothing in the app guards
  against that (no `@Version`, no lock — TODO-81). One container could not do
  this.
- **The mobile ID scanner is a native module and does NOT ship over the air.**
  `eas update` cannot deliver `@react-native-ml-kit/text-recognition`; it needs
  `eas build`. Installed builds without it simply do not show the button —
  `isIdScanAvailable()` hides it — rather than failing on touch.
