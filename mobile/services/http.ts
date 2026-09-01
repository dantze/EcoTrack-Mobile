import { API_BASE_URL } from '../constants/ApiConfig';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './tokenStore';

/**
 * The single way this app talks to the EcoTrack API.
 *
 * `apiFetch` is a drop-in for `fetch(`${API_BASE_URL}...`)` — it returns the
 * raw `Response`, so callers keep their own `response.ok` / `.json()` / `.text()`
 * handling — and adds the two things the app was missing:
 *
 *  1. **It sends the access token.** Until this existed the mobile app held no
 *     token at all, so every request reached the backend anonymously. That is
 *     the reason `ecotrack.security.enforce` is still `false` in production:
 *     turning it on would have taken the field crew offline.
 *  2. **It refreshes once, silently, on a 401.** Access tokens last 30 minutes,
 *     so without this a driver would be signed out mid-route twice an hour.
 *
 * Requests still go out unauthenticated when no token is stored (a device that
 * has not logged in since this shipped), which is exactly what keeps the app
 * working against a backend that is not enforcing yet.
 *
 * Only EcoTrack API calls belong here. Third-party endpoints — the Google Places
 * lookups in LocationPicker, for one — must keep using plain `fetch`: sending
 * our bearer token to another host would leak it.
 */

/** Refresh is single-flight: a burst of parallel 401s must not rotate the
 *  refresh token several times over. Every loser awaits the same promise. */
let refreshInFlight: Promise<string | null> | null = null;

let onSessionExpired: (() => void) | null = null;

/**
 * Registers what to do when the session is gone for good — refresh itself was
 * rejected, so the user has to log in again. Wired in `app/_layout.tsx`.
 */
export const setOnSessionExpired = (handler: (() => void) | null): void => {
    onSessionExpired = handler;
};

const withAuthHeader = (init: RequestInit, token: string | null): RequestInit => {
    if (!token) return init;
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);
    // Note: only Authorization is touched. Content-Type is left exactly as the
    // caller had it, so multipart uploads keep the boundary fetch generated.
    return { ...init, headers };
};

const refreshAccessToken = async (): Promise<string | null> => {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async (): Promise<string | null> => {
        try {
            const refreshToken = await getRefreshToken();
            if (!refreshToken) return null;

            // Plain fetch, not apiFetch: this call must never recurse into the
            // refresh path, and it authenticates with the refresh token itself.
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });

            if (!response.ok) return null;

            const data = await response.json();
            if (!data?.accessToken || !data?.refreshToken) return null;

            await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
            return data.accessToken as string;
        } catch (error) {
            // A network failure is not an expired session — report it as a
            // failed refresh but let the caller surface the original error.
            console.error('[http] Token refresh failed:', error);
            return null;
        } finally {
            refreshInFlight = null;
        }
    })();

    return refreshInFlight;
};

export interface ApiFetchOptions {
    /**
     * Send the request with NO Authorization header, and never refresh-retry it.
     *
     * Required for `/enrollment/**`. Those endpoints are `permitAll`, but
     * `BearerTokenAuthenticationFilter` runs before authorisation and answers
     * 401 to ANY request carrying a bearer token it cannot validate
     * (`ecotrack.security.reject-invalid-bearer`, default on). A device whose
     * session was revoked still has that dead token in AsyncStorage, so
     * attaching it would make the one screen that could recover the device the
     * one screen it cannot reach.
     */
    anonymous?: boolean;
}

/**
 * @param path API path *relative to the /api root*, e.g. `/tasks/12` — not a
 *             full URL. Leading slash included.
 */
export const apiFetch = async (
    path: string,
    init: RequestInit = {},
    options: ApiFetchOptions = {},
): Promise<Response> => {
    const url = `${API_BASE_URL}${path}`;

    if (options.anonymous) {
        return fetch(url, init);
    }

    const accessToken = await getAccessToken();
    const response = await fetch(url, withAuthHeader(init, accessToken));

    if (response.status !== 401) return response;

    // /auth/** answers 401 to mean "these credentials are wrong" — login and
    // refresh failures are the caller's to render, not something to retry.
    if (path.startsWith('/auth/')) return response;

    // Nothing to refresh with: the app is running token-less against a backend
    // that is not enforcing, and this 401 came from somewhere else.
    if (!accessToken) return response;

    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
        await clearTokens();
        onSessionExpired?.();
        return response;
    }

    return fetch(url, withAuthHeader(init, newAccessToken));
};
