/**
 * Base URL for every EcoTrack API call the app makes (see services/http.ts).
 *
 * Set EXPO_PUBLIC_API_BASE_URL to point a build at a different backend. Expo
 * inlines EXPO_PUBLIC_* at BUNDLE time, so this is baked into the JS: it is
 * read when the bundler runs, never at app startup, and no app restart picks up
 * a change to it.
 *
 * **Bundle time is not the same as build time**, and the difference is what
 * TODO-72 turned on. `eas update` re-bundles, so an OTA carries a NEW value of
 * this variable to already-installed apps — which is how phones built against
 * the retired droplet get pointed at Cloud Run without a store release. What an
 * OTA cannot change is the native layer: modules compiled into the binary, and
 * anything `app.config.js` puts in the manifest.
 *
 * **Production is the Cloud Run URL**, which Terraform prints as the
 * `backend_api_base_url` output:
 *
 *     EXPO_PUBLIC_API_BASE_URL=https://<service>-<hash>.<region>.run.app/api
 *
 * It has to be set as a repository variable for deploy-mobile.yml — there is no
 * sensible default, because the host is generated when the service is created
 * and is not knowable from this repository. That workflow refuses to ship
 * anything while it is unset, precisely because an OTA reaches every installed
 * phone and the fallback below is not a working backend for any of them.
 *
 * The fallback is localhost, for a developer running the backend from
 * `docker compose` (which publishes 8080). It used to be
 * `http://146.190.224.202:8080/api`, a DigitalOcean droplet that was retired
 * with the VPS deployment — a build that forgot the variable would spend its
 * requests on a stranger's IP and fail with something that looked like a
 * network problem. Failing against localhost is the same amount of broken and
 * says which variable is missing.
 *
 * **The empty string counts as unset.** `??` does not catch it, and an unset
 * GitHub variable interpolates to `''` rather than disappearing — so without
 * the trim below, a workflow that lost the variable would bundle `''` and every
 * request would be built from a relative path with no origin. That is a
 * stranger failure to read than localhost, for the same missing variable.
 *
 * A trailing slash is dropped for the same reason a leading one is required on
 * every path in services/http.ts: the two are concatenated, and `…/api/` plus
 * `/tasks` is a URL with an empty path segment in the middle. Accepting the
 * slash here is what lets the workflow guard accept it too, rather than
 * refusing an address that is not wrong.
 */
const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');

export const API_BASE_URL = configured ? configured : 'http://localhost:8080/api';
