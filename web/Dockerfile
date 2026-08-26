# =========================================================================
# Multi-stage Dockerfile for the EcoTrack web SPA
# =========================================================================
# Stage 1 builds the Vite bundle; stage 2 serves the static output.
#
# The build is parameterised because Vite inlines VITE_* at BUILD time — these
# are not runtime env vars. Changing any of them requires a rebuild, which is
# why the deploy always runs `up -d --build`.

# --- Stage 1: Build the bundle ---
FROM node:22-alpine AS builder

WORKDIR /app

# Deps first so the layer caches until the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Defaults describe the production deployment: the SPA is served from the same
# Caddy that fronts the API, so a RELATIVE /api base is same-origin. That is
# what removes both the CORS preflight and the mixed-content problem that kept
# live mode undeployable while the backend was plain HTTP on a bare IP.
ARG VITE_DATA_MODE=live
ARG VITE_API_BASE_URL=/api
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_DATA_MODE=$VITE_DATA_MODE \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# --- Stage 2: Static file server ---
FROM caddy:2.8-alpine AS runtime

COPY --from=builder /app/dist /srv

# SPA fallback: React Router owns the paths, so any URL that is not a real file
# must return index.html rather than a 404.
RUN printf ':80 {\n\
    root * /srv\n\
    encode zstd gzip\n\
    try_files {path} /index.html\n\
    file_server\n\
}\n' > /etc/caddy/Caddyfile

EXPOSE 80
