/**
 * Refresh-token persistence.
 *
 * Access tokens live in memory only (see AuthProvider / tokenBridge.ts) and
 * are never written to storage. The refresh token has to survive a page
 * reload, so it lives in localStorage under a *versioned* key — bumping the
 * suffix is how a future change to the token format invalidates whatever an
 * older build left behind, instead of the app trying to refresh with a value
 * it can no longer parse.
 *
 * TODO(post-TLS): once the backend serves HTTPS, move this to an httpOnly,
 * Secure, SameSite=None cookie set by the server on /auth/login and
 * /auth/refresh. That is not possible today — the web origin and the API
 * origin differ, the API is plain HTTP, and a browser will not set or keep a
 * Secure/SameSite=None cookie over a non-TLS connection — so localStorage is
 * the least-bad option until then.
 *
 * Both the live and mock auth implementations use this same module (and the
 * same key), same reasoning as the old single-mode session store this
 * replaces: switching VITE_DATA_MODE should not strand a session behind a key
 * the other mode cannot see.
 */

export const REFRESH_TOKEN_KEY = 'ecotrack.refreshToken.v1';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Safari in private mode, or a non-browser test environment.
    return null;
  }
}

export function readRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function saveRefreshToken(token: string): void {
  storage()?.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearRefreshToken(): void {
  storage()?.removeItem(REFRESH_TOKEN_KEY);
}
