/**
 * Base URL for every EcoTrack API call the app makes (see services/http.ts).
 *
 * Set EXPO_PUBLIC_API_BASE_URL to point a build at a different backend — Expo
 * inlines EXPO_PUBLIC_* at BUILD time, so this is baked into the binary and
 * into each OTA update, not read at runtime. Changing it requires a new
 * `eas build` (or at least a new `eas update`), never just an app restart.
 *
 * The fallback is the bare-IP HTTP origin the older installed builds have
 * always used. It still works — docker-compose keeps port 8080 published
 * alongside Caddy — which is what stops an unset variable from bricking the
 * app. Prefer the HTTPS domain once DOMAIN_NAME is live:
 *     EXPO_PUBLIC_API_BASE_URL=https://api.ecotrack.ro/api
 */
export const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://146.190.224.202:8080/api';
