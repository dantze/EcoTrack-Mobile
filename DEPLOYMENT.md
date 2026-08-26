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
GOOGLE_CLIENT_ID  GOOGLE_ALLOWED_DOMAIN
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

## Gotchas

- `ECOTRACK_SECURITY_ENFORCE=true` logs out every device on a pre-token build.
  Ship mobile, confirm rollout, *then* flip.
- `VITE_*` / `EXPO_PUBLIC_*` are **build-time**. Changing one needs a rebuild.
- `runtimeVersion` is `appVersion`: bumping `expo.version` fences OTAs off from
  older installs until they get a new binary. Intentional.
- No DB migrations (`ddl-auto=update`). Destructive schema changes are manual.
