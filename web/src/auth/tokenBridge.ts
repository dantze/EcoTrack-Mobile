/**
 * Seam between the fetch layer and the auth module.
 *
 * `http.ts` (src/api/live) needs to attach the current access token to every
 * request and, on a 401, ask for a silent refresh and retry once — but it
 * must not import from `src/auth` directly: `AuthProvider` calls into `@/api`
 * for the network side of login/refresh, and a two-way import would cycle.
 * This module is the acyclic seam in between. `AuthProvider` registers its
 * token and its refresh function here on mount; `http.ts` reads through it
 * without knowing anything else about auth state. The mock auth module also
 * reads the access token from here — it has no HTTP layer of its own, but
 * still needs to know "who does this token belong to" for GET /auth/me and
 * GET /auth/sessions.
 *
 * The access token is intentionally never persisted anywhere — see
 * src/auth/storage.ts for why only the refresh token survives a reload.
 */

let accessToken: string | null = null;
let refresher: (() => Promise<string | null>) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** AuthProvider registers its refresh function here on mount, clears it on unmount. */
export function setRefresher(fn: (() => Promise<string | null>) | null): void {
  refresher = fn;
}

/**
 * Runs the registered refresh exactly once and returns the new access token,
 * or null if it failed (or nothing has registered a refresher yet — e.g. a
 * request racing app boot). Never throws: a failed refresh is a normal
 * outcome for http.ts, not a fault.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refresher) return null;
  try {
    return await refresher();
  } catch {
    return null;
  }
}
