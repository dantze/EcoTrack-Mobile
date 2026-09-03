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

let onSessionRenewed: (() => void) | null = null;

/**
 * Registers what to do when the session is gone for good — refresh itself was
 * rejected, so the user has to log in again. Wired in `app/_layout.tsx`.
 */
export const setOnSessionExpired = (handler: (() => void) | null): void => {
    onSessionExpired = handler;
};

/**
 * Registers what to do after a silent refresh SUCCEEDS (TODO-35).
 *
 * The device has just proved its session is still live, which is the natural
 * moment to re-read who it belongs to: `user.roles` is a cached copy that
 * decides which menus are drawn, and nothing else ever refetches it between
 * launches.
 *
 * Today a role change also revokes every session that employee holds, so the
 * usual path is the expired one above. This exists because that guarantee is a
 * side effect of a different feature (`AdminService.updateEmployee`) and could
 * be relaxed without anyone noticing this depended on it. Fire-and-forget: the
 * request that triggered the refresh must not wait on it.
 */
export const setOnSessionRenewed = (handler: (() => void) | null): void => {
    onSessionRenewed = handler;
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

    // The two /auth endpoints that authenticate with the REFRESH token rather
    // than the access token. Their 401 means "this credential is wrong", which
    // no retry can fix, and the caller renders it.
    //
    // Deliberately NOT all of /auth/**, which is what this said until TODO-35.
    // GET /auth/me is an ordinary bearer read, and the boot gate calls it on
    // every launch — where the stored access token is almost always older than
    // its 30-minute life. Blanket-excluding /auth/** meant that call 401'd and
    // gave up before the refresh it was entitled to, so the roles it exists to
    // re-read were never re-read.
    if (path === '/auth/refresh' || path === '/auth/logout') return response;

    // Nothing to refresh with: the app is running token-less against a backend
    // that is not enforcing, and this 401 came from somewhere else.
    if (!accessToken) return response;

    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
        await clearTokens();
        onSessionExpired?.();
        return response;
    }

    // Not awaited, and never for /auth/me itself — that request IS the hook's
    // work, and letting it re-trigger the hook would be a loop.
    if (path !== '/auth/me') onSessionRenewed?.();

    return fetch(url, withAuthHeader(init, newAccessToken));
};

// ---------------------------------------------------------------------------
// The server's own words (TODO-51)
// ---------------------------------------------------------------------------

/**
 * Statuses whose response body is known to carry text written for the driver.
 *
 * The same allowlist, and the same reasoning, as `serverMessage` in
 * `web/src/api/http.ts` — 401/403 are generic ON PURPOSE so an unauthorized
 * caller is not told which rule stopped them, 413 and 5xx are English
 * boilerplate, and what is left is the set whose message comes from a domain
 * exception. **The two copies are deliberate**: the projects cannot import each
 * other (CLAUDE.md, Conventions), and this is a dozen lines rather than a
 * parser worth pinning to a shared fixture. Change one and change the other.
 */
const USER_FACING_STATUSES = new Set([400, 404, 409]);

/** Verbatim from the backend's `GlobalExceptionHandler`; English, not for the driver. */
const GENERIC_SERVER_MESSAGES = new Set([
    'Request validation failed. Check field details.',
    'Malformed request body.',
    'Request could not be processed.',
]);

/** Longer than any refusal the backend writes; anything past it is not prose. */
const MAX_SERVER_MESSAGE = 400;

/**
 * The backend's user-facing Romanian text for a failed response, or `null`.
 *
 * `body` is the raw response text. It is normally the four-key envelope
 * `GlobalExceptionHandler.body()` builds — `{timestamp, status, error, message}`
 * — so `.message` is preferred and the raw text is used only when the body is
 * not that envelope.
 */
export const messageFromBody = (status: number, body: string): string | null => {
    if (!USER_FACING_STATUSES.has(status)) return null;

    const text = body?.trim();
    if (!text) return null;

    let message = text;
    if (text.startsWith('{')) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            // An envelope we cannot read is not a message we can show.
            return null;
        }
        const candidate = (parsed as { message?: unknown } | null)?.message;
        if (typeof candidate !== 'string' || !candidate.trim()) return null;
        message = candidate.trim();
    }

    // A proxy's HTML error page, or a stack trace, is not something to show.
    if (message.startsWith('<') || message.length > MAX_SERVER_MESSAGE) return null;
    if (GENERIC_SERVER_MESSAGES.has(message)) return null;

    return message;
};

/**
 * The error to throw for a failed response: the server's own sentence when it
 * wrote one, and `fallback` otherwise.
 *
 * CONSUMES the response body, so a caller that also wants to read it must use
 * `messageFromBody` on text it read itself — `PhotoService` is the one that does.
 * A body that cannot be read at all is not a reason to lose the failure, so the
 * read is guarded and falls back like any other unusable body.
 */
export const apiError = async (response: Response, fallback: string): Promise<Error> => {
    let body = '';
    try {
        body = await response.text();
    } catch {
        /* fall back below */
    }
    return new Error(messageFromBody(response.status, body) ?? fallback);
};
