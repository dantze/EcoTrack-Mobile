/**
 * AuthController — /api/auth
 *
 * POST /auth/login and /auth/google both answer with the same envelope:
 * `success`, a Romanian `message`, and — only on success — `accessToken`,
 * `refreshToken`, `expiresIn`, and `user`. A failed login/Google attempt
 * comes back as HTTP 401 (login) or 403 (Google — the email is not
 * provisioned to an employee) carrying that same envelope, so both are
 * deliberately swallowed here and surfaced as `{success:false, message}`
 * rather than thrown — the login form wants to render the server's Romanian
 * message, not an exception.
 *
 * Do not branch on that message. A failed password login is always the single
 * string "Nume de utilizator sau parolă incorectă", whether the username exists
 * or not: telling the two apart would hand an attacker a free account-enumeration
 * oracle, so AuthService collapses them on purpose (it even burns an equivalent
 * bcrypt verify on the unknown-user path so the timing matches). The only other
 * login-failure message is the rate-limit one.
 *
 * The response also carries legacy flat fields (id/username/fullName/…) at
 * the top level for the old mobile app. We ignore them and read `user`.
 *
 * Every other call here (refresh, logout, me, sessions) rides on the
 * Authorization header http.ts attaches automatically from the token bridge —
 * this module never touches a header directly.
 */

import type { AuthApi, AuthSession, AuthTokens, LoginOutcome, SessionDevice } from '../contract';
import type { AuthUser, Role } from '@/types/domain';
import { num, optStr } from './normalize';
import { ApiError, request } from '../http';

interface RawAuthUser {
  id?: number;
  username?: string;
  fullName?: string;
  phone?: string | null;
  county?: string | null;
  email?: string | null;
  roles?: string[] | null;
}

interface RawAuthEnvelope {
  success?: boolean;
  message?: string | null;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: RawAuthUser;
}

interface RawTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RawSessionDevice {
  id: number | string;
  device?: string | null;
  createdAt?: string | null;
  lastUsedAt?: string | null;
  current?: boolean;
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

function toOutcome(raw: RawAuthEnvelope): LoginOutcome {
  if (!raw.success || !raw.user || !raw.accessToken || !raw.refreshToken) {
    return { success: false, message: raw.message ?? 'Autentificare eșuată' };
  }
  const session: AuthSession = {
    user: normalizeAuthUser(raw.user),
    tokens: {
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
      expiresIn: raw.expiresIn ?? 1800,
    },
  };
  return { success: true, message: raw.message ?? null, session };
}

/**
 * POST to an /auth/** endpoint that answers a `RawAuthEnvelope` on both
 * success and (some subset of) failure statuses — login's 401, Google's 403.
 * Any other failure status is a real fault and propagates as an ApiError.
 */
async function postAuthEnvelope(
  path: string,
  body: unknown,
  envelopeFailureStatuses: number[],
): Promise<LoginOutcome> {
  let raw: RawAuthEnvelope;
  try {
    raw = await request<RawAuthEnvelope>(path, { method: 'POST', body });
  } catch (error) {
    if (error instanceof ApiError && envelopeFailureStatuses.includes(error.status)) {
      try {
        raw = JSON.parse(error.body) as RawAuthEnvelope;
      } catch {
        return { success: false, message: 'Autentificare eșuată' };
      }
    } else {
      throw error;
    }
  }
  return toOutcome(raw);
}

function normalizeSessionDevice(raw: RawSessionDevice): SessionDevice {
  return {
    id: String(raw.id),
    device: raw.device ?? 'Dispozitiv necunoscut',
    createdAt: raw.createdAt ?? '',
    lastUsedAt: raw.lastUsedAt ?? '',
    current: raw.current ?? false,
  };
}

export const authApi: AuthApi = {
  login(username: string, password: string): Promise<LoginOutcome> {
    return postAuthEnvelope('/auth/login', { username, password }, [401]);
  },

  loginWithGoogle(idToken: string): Promise<LoginOutcome> {
    return postAuthEnvelope('/auth/google', { idToken }, [401, 403]);
  },

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
