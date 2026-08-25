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
