/**
 * Where the EcoTrack web app lives, for the one screen that points at it
 * (`app/office.tsx`).
 *
 * **This used to be derived, and deriving it is now wrong** (TODO-84). The
 * signpost took `API_BASE_URL` and stripped the `/api` suffix, on the reasoning
 * that "the web app is the same deployment as the API — Caddy serves the SPA
 * and proxies `/api` to the backend on one domain". That was true of the
 * droplet. TODO-71 replaced it with Cloud Run plus Vercel, which are two
 * origins — the same fact that makes CORS load-bearing — so stripping `/api`
 * off the Cloud Run URL names the BACKEND, and the screen whose whole job is to
 * send a salesperson to the web app would have sent them somewhere that serves
 * JSON.
 *
 * So it is configured, not computed. `EXPO_PUBLIC_WEB_APP_URL` is Terraform's
 * `frontend_url` output (a custom domain in `web_custom_domains` serves the
 * same deployment and is equally valid here). Like every `EXPO_PUBLIC_*` it is
 * inlined when the bundler runs, so `eas update` carries a change to it.
 *
 * **Unset resolves to `null`, and null means the screen says so** rather than
 * guessing. There is no honest fallback: an address invented from the API base
 * is exactly the bug above, and localhost is not somewhere an office phone can
 * go. A screen that admits it has no address is a bug report from the person
 * holding the phone; a screen showing a plausible wrong one is a support call
 * about the web app being broken.
 */
export function resolveWebAppUrl(raw: string | undefined): string | null {
    // Trimmed and de-slashed for the same reasons as API_BASE_URL: an unset
    // GitHub variable arrives as '', and a trailing slash is noise in a URL
    // printed for a human to read and retype.
    const configured = raw?.trim().replace(/\/+$/, '');
    return configured ? configured : null;
}

export const WEB_APP_URL = resolveWebAppUrl(process.env.EXPO_PUBLIC_WEB_APP_URL);
