/**
 * Persisted session.
 *
 * The backend issues no token — POST /auth/login just returns the employee
 * record — so "being logged in" is nothing more than a user object in
 * localStorage. Both the live client and the mock client use this same module
 * (and the same storage key) so switching VITE_DATA_MODE does not strand a
 * session behind a key the other mode cannot see.
 *
 * See README "Known gaps": this is trivially forgeable from devtools and needs
 * a real server-side session before the app is exposed publicly.
 */

import type { AuthUser, LoginResponse, Role } from '@/types/domain';

const SESSION_KEY = 'ecotrack.session';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Safari in private mode, or a non-browser test environment.
    return null;
  }
}

export function readSession(): AuthUser | null {
  const raw = storage()?.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser> | null;
    if (!parsed || typeof parsed.id !== 'number' || typeof parsed.username !== 'string') {
      return null;
    }
    return {
      id: parsed.id,
      username: parsed.username,
      fullName: parsed.fullName ?? '',
      phone: parsed.phone ?? null,
      county: parsed.county ?? null,
      roles: Array.isArray(parsed.roles) ? (parsed.roles as Role[]) : [],
    };
  } catch {
    // Corrupted entry — drop it rather than wedging every page load.
    clearSession();
    return null;
  }
}

export function saveSession(user: AuthUser): void {
  storage()?.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  storage()?.removeItem(SESSION_KEY);
}

/** Lifts the flat LoginResponse into an AuthUser, or null when it failed. */
export function sessionFromLogin(response: LoginResponse): AuthUser | null {
  if (!response.success || typeof response.id !== 'number') return null;
  return {
    id: response.id,
    username: response.username ?? '',
    fullName: response.fullName ?? '',
    phone: response.phone ?? null,
    county: response.county ?? null,
    roles: Array.isArray(response.roles) ? response.roles : [],
  };
}
