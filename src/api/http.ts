/**
 * Thin fetch wrapper for the live backend.
 *
 * Deliberately minimal: the backend has no auth tokens (login returns a user
 * object and nothing else), CORS is already `*`, and every endpoint speaks
 * plain JSON except the two multipart photo uploads.
 */

import { ADMIN_KEY, API_BASE_URL } from '@/lib/config';

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
  /** Adds the X-Admin-Key header required by /api/admin/**. */
  admin?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, admin = false, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  const isFormData = body instanceof FormData;

  // Let the browser set Content-Type for multipart so the boundary is correct.
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  if (admin && ADMIN_KEY) headers['X-Admin-Key'] = ADMIN_KEY;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    signal,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  if (!response.ok) {
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
