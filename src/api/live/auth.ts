/**
 * AuthController — /api/auth
 *
 * The only network call is the login itself. A successful response is persisted
 * to localStorage; `currentUser()` and `logout()` never touch the network.
 * A failed login comes back as HTTP 401 with the same LoginResponse body, so we
 * deliberately swallow that status and surface `{success:false, message}`
 * instead of throwing — the login form wants to render the Romanian message
 * ("Utilizator inexistent" / "Parolă incorectă"), not an exception.
 */

import type { AuthApi } from '../contract';
import type { AuthUser, LoginResponse, Role } from '@/types/domain';
import { ApiError, request } from '../http';
import { clearSession, readSession, saveSession, sessionFromLogin } from './session';

interface RawLoginResponse {
  id?: number;
  username?: string;
  fullName?: string;
  phone?: string | null;
  county?: string | null;
  roles?: string[] | null;
  message?: string | null;
  success?: boolean;
}

function toLoginResponse(raw: RawLoginResponse): LoginResponse {
  return {
    id: raw.id,
    username: raw.username,
    fullName: raw.fullName,
    phone: raw.phone ?? null,
    county: raw.county ?? null,
    roles: Array.isArray(raw.roles) ? (raw.roles.map((r) => r.toUpperCase()) as Role[]) : undefined,
    message: raw.message ?? null,
    success: raw.success ?? false,
  };
}

export const authApi: AuthApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    let raw: RawLoginResponse;

    try {
      raw = await request<RawLoginResponse>('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
    } catch (error) {
      // 401 carries a well-formed LoginResponse; anything else is a real fault.
      if (error instanceof ApiError && error.status === 401) {
        try {
          raw = JSON.parse(error.body) as RawLoginResponse;
        } catch {
          return { message: 'Autentificare eșuată', success: false };
        }
      } else {
        throw error;
      }
    }

    const response = toLoginResponse(raw);
    const user = sessionFromLogin(response);
    if (user) saveSession(user);
    return response;
  },

  currentUser(): AuthUser | null {
    return readSession();
  },

  logout(): void {
    clearSession();
  },
};
