/**
 * Thin fetch wrapper for the live backend.
 *
 * Every endpoint speaks plain JSON except the two multipart photo uploads.
 *
 * Auth: the access token currently held by the auth module (in memory only —
 * see src/auth/tokenBridge.ts) is attached as `Authorization: Bearer <token>`
 * to every request that has one available, including the admin endpoints —
 * /api/admin/** is authorised by the caller's role inside that token now,
 * not by a shared secret. A 401 from anything other than the /auth/**
 * endpoints themselves triggers exactly one silent refresh-and-retry; if the
 * refresh also fails, the caller sees the original 401 and the auth module's
 * own failure handling logs the user out.
 */

import { API_BASE_URL } from '@/lib/config';
import { getAccessToken, refreshAccessToken } from '@/auth/tokenBridge';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialised as JSON. Pass FormData to send multipart instead. */
  body?: unknown;
  signal?: AbortSignal;
}

async function attempt<T>(path: string, options: RequestOptions, isRetry: boolean): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const isFormData = body instanceof FormData;

  // Let the browser set Content-Type for multipart so the boundary is correct.
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    signal,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  if (!response.ok) {
    // /auth/** handles its own 401s (a bad login/refresh is an expected
    // outcome, not a lapsed session) — never loop a refresh-retry through it.
    const isAuthEndpoint = path.startsWith('/auth/');
    if (response.status === 401 && !isRetry && !isAuthEndpoint) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return attempt<T>(path, options, true);
    }

    throw new ApiError(
      `${method} ${path} failed with ${response.status}`,
      response.status,
      text,
    );
  }

  // 204 No Content, and DELETEs that return an empty body.
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    // A few endpoints (photo upload/delete) return a bare string message.
    return text as T;
  }
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return attempt<T>(path, options, false);
}

// ---------------------------------------------------------------------------
// The server's own words (TODO-51)
// ---------------------------------------------------------------------------

/**
 * Statuses whose response body is known to carry text written for the operator.
 *
 * This is the allowlist half of TODO-51, chosen over "surface `body` whenever
 * it is non-empty" because the backend's `GlobalExceptionHandler` answers some
 * statuses with deliberately generic ENGLISH prose, and showing that in a
 * Romanian toast is worse than the status code it replaces:
 *
 *   401 / 403  "Authentication required…" / "Access denied: insufficient
 *              permissions." — generic ON PURPOSE, so an unauthorized caller is
 *              not told which rule stopped them. Never surface it.
 *   413        "File upload exceeds the maximum allowed size limit."
 *   5xx        "An unexpected error occurred. Please try again later."
 *
 * What is left is the set whose message comes from a domain exception, and
 * those were each written to be read:
 *
 *   400  IllegalArgumentException
 *   404  ResourceNotFoundException          — "Ruta nu a fost găsită"
 *   409  IllegalStateException              — the retired-plan refusal (TODO-39),
 *        InsufficientQuantityException        SubscriptionService.blockedMessage
 *
 * A new backend handler that answers one of these with generic text belongs in
 * GENERIC_SERVER_MESSAGES below, not in a fourth copy of this rule on a screen.
 */
const USER_FACING_STATUSES: ReadonlySet<number> = new Set([400, 404, 409]);

/**
 * Messages an allowlisted status can still carry that are NOT for the operator.
 * All three are 400s raised by Spring itself rather than by our services, and
 * all three are verbatim from `GlobalExceptionHandler`.
 */
const GENERIC_SERVER_MESSAGES: ReadonlySet<string> = new Set([
  'Request validation failed. Check field details.',
  'Malformed request body.',
  'Request could not be processed.',
]);

/** Longer than any refusal the backend writes; anything past it is not prose. */
const MAX_SERVER_MESSAGE = 400;

/**
 * The backend's user-facing Romanian text for a failed request, or `null`.
 *
 * `ApiError.body` is the raw response text. It is normally the four-key error
 * envelope `GlobalExceptionHandler.body()` builds — `{timestamp, status, error,
 * message}` — so `.message` is preferred and the raw text is only used when the
 * body is not that envelope. Returns `null` rather than guessing whenever the
 * body is missing, unparseable, not prose, or one of the generic strings above;
 * every caller has a phrasing of its own to fall back to.
 */
export function serverMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (!USER_FACING_STATUSES.has(error.status)) return null;

  const text = error.body?.trim();
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

  // A proxy's HTML error page, or a stack trace, is not something to toast.
  if (message.startsWith('<') || message.length > MAX_SERVER_MESSAGE) return null;
  if (GENERIC_SERVER_MESSAGES.has(message)) return null;

  return message;
}
