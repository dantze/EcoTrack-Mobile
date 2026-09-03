/**
 * AuthController — /api/auth
 *
 * Session endpoints for a device that is ALREADY enrolled. There is no login
 * and no Google handshake: both were removed from the backend outright, along
 * with passwords. A first session comes from `enrollment.claim` once an admin
 * has approved the device — see ./enrollment.ts.
 *
 * Every call here rides on the Authorization header http.ts attaches
 * automatically from the token bridge; this module never touches a header
 * directly.
 */

import type { AuthApi, AuthTokens, SessionDevice } from '../contract';
import type { AuthUser, Role } from '@/types/domain';
import { normalizeSessionDevice, num, optStr, type RawSessionDevice } from './normalize';
import { request } from '../http';

interface RawAuthUser {
  id?: number;
  username?: string;
  fullName?: string;
  phone?: string | null;
  county?: string | null;
  email?: string | null;
  roles?: string[] | null;
}

interface RawTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}


function normalizeAuthUser(raw: RawAuthUser): AuthUser {
  return {
    id: num(raw.id),
    username: raw.username ?? '',
    fullName: raw.fullName ?? '',
    phone: optStr(raw.phone),
    county: optStr(raw.county),
    email: optStr(raw.email),
    roles: Array.isArray(raw.roles) ? (raw.roles.map((r) => r.toUpperCase()) as Role[]) : [],
  };
}


export const authApi: AuthApi = {
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const raw = await request<RawTokens>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    return { accessToken: raw.accessToken, refreshToken: raw.refreshToken, expiresIn: raw.expiresIn };
  },

  async logout(refreshToken: string | null): Promise<void> {
    if (!refreshToken) return;
    // Best-effort: the caller (AuthProvider) has already cleared local state
    // by the time this is called, so a network failure here is not fatal.
    try {
      await request<void>('/auth/logout', { method: 'POST', body: { refreshToken } });
    } catch {
      /* ignore */
    }
  },

  async me(): Promise<AuthUser> {
    return normalizeAuthUser(await request<RawAuthUser>('/auth/me'));
  },

  async listSessions(): Promise<SessionDevice[]> {
    const raw = await request<RawSessionDevice[]>('/auth/sessions');
    return (raw ?? []).map(normalizeSessionDevice);
  },

  async revokeSession(id: string): Promise<void> {
    await request<void>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async revokeOtherSessions(): Promise<void> {
    await request<void>('/auth/sessions', { method: 'DELETE' });
  },
};
