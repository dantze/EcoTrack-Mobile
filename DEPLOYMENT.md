# Deployment

## Triggers

| Change | Do this | Result |
|---|---|---|
| `backend/**` or `web/**` | merge to `main` | VPS rebuilds stack, live over HTTPS — **only while `DEPLOY_ENABLED=true`** |
| `mobile/**` (JS only) | merge to `main` | OTA — apps update on next launch |
| `mobile/**` (native) | Actions → Deploy Mobile → `build-production` | Play Store bundle |

All gated on CI. Red tests = no deploy.

> **The stack deploy is switched OFF right now** (TODO-32). There is no VPS, and
> every push touching `backend/**`, `web/**`, `docker-compose.yml` or the
> `Caddyfile` was failing at the SSH step and turning `main` red — which is how
> a team learns to ignore a red `main`, taking the two CI gates in the same run
> down with it. The gates still run on every push; only the SSH step is skipped,
> and the run says so with a warning annotation.
>
> **To turn it back on:** Settings → Secrets and variables → Actions →
> *Variables* → `DEPLOY_ENABLED` = `true`. Nothing else changes.
> **To deploy once without turning it on** — testing a fresh server, say —
> Actions → Deploy → *Run workflow*. A manual run ignores the variable
> deliberately, so it will attempt the SSH and fail loudly if the host is wrong,
> which is exactly what you want when you are checking one.

Native = new native module, SDK bump, plugin/permission change, or `expo.version`
bump. An OTA cannot carry those.

## One-time setup

**1. DNS** — A record → VPS IP. Caddy issues TLS automatically.

**2. GitHub → Settings → Secrets and variables → Actions → Secrets:**

```
SERVER_IP  SERVER_USER  SSH_PRIVATE_KEY  DOMAIN_NAME
DB_NAME  DB_USER  DB_PASS
DO_SPACES_ACCESS_KEY  DO_SPACES_SECRET_KEY  DO_SPACES_BUCKET  DO_SPACES_REGION
ECOTRACK_SECURITY_ENFORCE  ECOTRACK_CORS_ALLOWED_ORIGINS
EXPO_TOKEN                       # expo.dev → Account → Access tokens
```

`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is no longer used and can be deleted from
the repository secrets — and **revoked in the Google Cloud console**, which is
the half that stops it billing. TODO-33 deleted the Sales section, and with it
the only map and the only address lookup the mobile app had.

**Variables** (optional; defaults shown):
```
DEPLOY_ENABLED=       # unset. Set to "true" once a VPS exists — see Triggers
VITE_DATA_MODE=live   VITE_API_BASE_URL=/api
EXPO_PUBLIC_API_BASE_URL=https://<domain>/api
```

A variable rather than a secret on purpose: it is not sensitive, and `vars` can
be read in a workflow `if:` where `secrets` cannot — which is what lets the
gate live in the workflow instead of in a wrapper job.

**3. VPS** — needs only Docker + git. First deploy clones the repo itself.
Then set `DEPLOY_ENABLED=true`, or the stack deploy stays skipped.

**If the deploy fails at the SSH step**, the error text narrows it before you
start guessing. `dial tcp ***:22: i/o timeout` means the packets were DROPPED —
no host, a powered-off host, or a firewall DROP — so check, in order: the
droplet exists and is running, the cloud firewall and `ufw` allow inbound 22,
and `SERVER_IP` is not stale after a rebuild. A wrong-but-alive machine answers
`connection refused` in milliseconds instead, which points at sshd rather than
the network (`deploy.yml` sets no `port:`, so it expects 22). `***` in the log
means the secret HAS a value; an empty secret prints as nothing.

**Optional secret:** `ECOTRACK_SETUP_CODE` — see *First enrolment* below.

## First enrolment

**There is no password and no sign-up.** The first access request on an empty
database becomes ADMIN, and it must carry a one-time code. Two ways to get one:

**A. Choose it up front (no SSH needed).** Set `ECOTRACK_SETUP_CODE` as a GitHub
Actions secret before the first deploy. Whoever holds it performs the first
enrolment from the app; nobody has to read a server log.

```bash
openssl rand -base64 18        # 12 characters minimum, or it is IGNORED
```

It is **inert the moment one employee exists**, so it is not a standing
credential — but rotate the secret afterwards anyway, and never reuse it as the
lockout recovery code (it is not accepted as one).

**B. Read the generated one** (what happens when the secret is unset):

```bash
ssh <user>@<vps>
cd ~/Dami-Prod-EcoTrack
docker compose logs backend | grep -A4 'First-run admin code'
```

Then: open the app → *Solicită acces* → name + the code → the device is ADMIN
immediately and everyone else's requests go to that admin for approval.

## Recovering when no admin can sign in

If the **last** admin logs out or loses their only device, nobody is left to
approve anything. The server detects this and logs a single-use recovery code:

```bash
docker compose logs backend | grep -A6 'Admin recovery code'
```

Enter it on the access-request screen (the field is labelled *Cod de recuperare*
and only appears in this state) and it mints a **new** ADMIN. The old admin's
row survives with no sessions — delete it in Angajați afterwards if it is a
duplicate.

The code is minted when the state is first observed, so hit `/api/enrollment/status`
(just open the app) if nothing is in the log yet. It is **not** the same as
`ECOTRACK_SETUP_CODE`, which is deliberately not accepted here.

## Rollback

Revert the commit, push. Mobile OTA: `eas update:republish --branch production`.

## Layout

One domain, one Caddy, no CORS:

```
https://<domain>/api/*       → backend:8080
                /actuator/*  → backend:8080  (health only)
                /*           → web:80        (SPA, index.html fallback)
```

Port 8080 stays open so older mobile builds keep working.

## Local

```bash
cp .env.example .env     # set DB_PASS
docker compose up -d --build
```
→ `https://localhost` (self-signed warning expected).

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

The local H2 file is `backend/data/damiprod`; on the VPS, `docker compose exec
-T postgres psql -U "$DB_USER" -d "$DB_NAME"`. Run the bucket check above first
if it has not been run for that environment — the column is the last thing that
would have told you which objects existed.

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
- No DB migrations (`ddl-auto=update`). Destructive schema changes are manual.
- The web image build downloads the ID scanner's language model once, from a
  pinned `tessdata_fast` tag, verified against a SHA-256 in
  `web/scripts/fetch-ocr-assets.mjs`. **A web build needs network for that**, and
  fails loudly rather than shipping a scanner with no model.
- **The mobile ID scanner is a native module and does NOT ship over the air.**
  `eas update` cannot deliver `@react-native-ml-kit/text-recognition`; it needs
  `eas build`. Installed builds without it simply do not show the button —
  `isIdScanAvailable()` hides it — rather than failing on touch.
