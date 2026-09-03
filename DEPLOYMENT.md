# Deployment

## Triggers

| Change | Do this | Result |
|---|---|---|
| `backend/**` or `web/**` | merge to `main` | VPS rebuilds stack, live over HTTPS |
| `mobile/**` (JS only) | merge to `main` | OTA — apps update on next launch |
| `mobile/**` (native) | Actions → Deploy Mobile → `build-production` | Play Store bundle |

All gated on CI. Red tests = no deploy.

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
VITE_DATA_MODE=live   VITE_API_BASE_URL=/api
EXPO_PUBLIC_API_BASE_URL=https://<domain>/api
```

**3. VPS** — needs only Docker + git. First deploy clones the repo itself.

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

## Draining the legacy ID photos (one time, per environment)

EcoTrack no longer stores photographs of identity documents (TODO-14). The
upload endpoints are deleted, but **objects uploaded by earlier builds are still
in Spaces**, and `individual.id_photo_url` is the only record of their keys.
They were written with a public-read ACL, so each one is a working
unauthenticated URL to a scan of someone's identity card.

This is an operator step on purpose — a deploy must not delete production data
as a side effect of somebody merging. Run it as ADMIN after the release lands:

```bash
# how many are left, and whose (ids only, never the URLs)
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<domain>/api/admin/id-photos

# delete the objects and clear the column
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://<domain>/api/admin/id-photos
```

Repeat the DELETE until `failed` is 0 and the GET reports `remaining: 0`. A row
whose object could not be deleted **keeps** its URL so the next run retries it —
that is deliberate, because clearing it would destroy the last reference to an
object still holding personal data.

Once every environment reports zero, the column, `AdminIdPhotoController` and
this section all go (TODO-45).

### If there is no running server to ask

The purge above needs a deployed app, and as of writing the deploy has never
succeeded (TODO-32). That does **not** mean there is nothing to drain: earlier
builds ran against the old `146.190.224.202` droplet, and the column is only a
record of keys — the objects outlive it.

Check the bucket directly instead. It needs the Spaces keys and nothing else:

```bash
# DigitalOcean Spaces is S3-compatible; use the region endpoint from .env.
aws s3 ls "s3://$DO_SPACES_BUCKET/persoane fizice/" \
    --endpoint-url "https://$DO_SPACES_REGION.digitaloceanspaces.com" \
    --recursive --human-readable --summarize
```

**`persoane fizice/` — with the space — is the prefix ID photos were written
under**, from `PhotosController.clientIdsFolderName` before that class was
deleted. Task photos are a different prefix and must be left alone.

If that lists nothing, there is nothing to drain and TODO-45's step 1 is
satisfied *for that bucket*; record which bucket was checked. If it lists
objects, delete them (`aws s3 rm` with the same `--endpoint-url`, or the purge
endpoint once a server exists) before dropping the column — dropping it first
strands them permanently.

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
