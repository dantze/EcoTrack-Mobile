/**
 * Base URL for every EcoTrack API call the app makes (see services/http.ts).
 *
 * Set EXPO_PUBLIC_API_BASE_URL to point a build at a different backend — Expo
 * inlines EXPO_PUBLIC_* at BUILD time, so this is baked into the binary and
 * into each OTA update, not read at runtime. Changing it requires a new
 * `eas build` (or at least a new `eas update`), never just an app restart.
 *
 * **Production is the Cloud Run URL**, which Terraform prints as the
 * `backend_api_base_url` output:
 *
 *     EXPO_PUBLIC_API_BASE_URL=https://<service>-<hash>.<region>.run.app/api
 *
 * It has to be set as an EAS environment variable — there is no sensible
 * default, because the host is generated when the service is created and is
 * not knowable from this repository.
 *
 * The fallback is localhost, for a developer running the backend from
 * `docker compose` (which publishes 8080). It used to be
 * `http://146.190.224.202:8080/api`, a DigitalOcean droplet that was retired
 * with the VPS deployment — a build that forgot the variable would spend its
 * requests on a stranger's IP and fail with something that looked like a
 * network problem. Failing against localhost is the same amount of broken and
 * says which variable is missing.
 *
 * **Installed builds still carry the old droplet address** and will keep
 * calling it until they are rebuilt — see TODO-72, which is the same rebuild
 * TODO-33 already needed.
 */
export const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';
