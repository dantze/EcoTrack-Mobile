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

// ---------------------------------------------------------------------------
// Device identity + pending enrollment ticket
// ---------------------------------------------------------------------------

const DEVICE_ID_KEY = 'ecotrack.deviceId.v1';
const PENDING_TICKET_KEY = 'ecotrack.enrollmentTicket.v1';

/**
 * A stable id for THIS browser, minted on first use.
 *
 * Self-asserted and therefore not a credential: anyone can send any value. It
 * exists so the admin can tell one device from another in the request queue,
 * and so a reload does not look like a brand-new device. What actually grants
 * access is the one-time claim secret below.
 */
export function readOrCreateDeviceId(): string {
  const store = storage();
  const existing = store?.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try {
    store?.setItem(DEVICE_ID_KEY, id);
  } catch {
    /* private mode — a per-session id is still better than none */
  }
  return id;
}

export interface PendingTicket {
  requestId: number;
  claimSecret: string;
  verificationCode: string;
  expiresAt: string;
}

/**
 * The in-flight request survives a reload on purpose: the user is told to keep
 * the screen open while an admin approves, and closing the tab by accident
 * should not force them to start over and read out a new code.
 */
export function readPendingTicket(): PendingTicket | null {
  try {
    const raw = storage()?.getItem(PENDING_TICKET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingTicket;
    return typeof parsed?.requestId === 'number' && typeof parsed?.claimSecret === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function savePendingTicket(ticket: PendingTicket): void {
  try {
    storage()?.setItem(PENDING_TICKET_KEY, JSON.stringify(ticket));
  } catch {
    /* ignore */
  }
}

export function clearPendingTicket(): void {
  try {
    storage()?.removeItem(PENDING_TICKET_KEY);
  } catch {
    /* ignore */
  }
}
