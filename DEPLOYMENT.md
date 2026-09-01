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
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
```

**Variables** (optional; defaults shown):
```
VITE_DATA_MODE=live   VITE_API_BASE_URL=/api
EXPO_PUBLIC_API_BASE_URL=https://<domain>/api
```

**3. VPS** — needs only Docker + git. First deploy clones the repo itself.

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
