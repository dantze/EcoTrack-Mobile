/**
 * Auth core: session state, silent refresh, and cross-tab sync.
 *
 * This is the one place that knows how a session is established and kept
 * alive. Everything else — the login form, the route guards, the shell's user
 * menu — only ever calls `useAuth()`.
 *
 * A few things worth knowing before touching this file:
 *
 *   - `status` starts at `'loading'` and stays there until the boot restore
 *     (below) resolves one way or the other. Routes gate on this so the app
 *     never flashes the login screen for a user who is actually signed in.
 *   - The access token lives in memory only, via `tokenBridge` — never in
 *     `state` here, so a re-render can't accidentally serialise it anywhere.
 *     The refresh token is the only thing persisted (`storage.ts`).
 *   - `runRefresh` is the single place a refresh actually happens. It is
 *     deduplicated: concurrent callers (the periodic timer, a 401 retry from
 *     three parallel queries, the boot restore) share one in-flight promise
 *     instead of firing three refresh calls for one token.
 *   - A failed refresh always means "log out" — there is no partial-failure
 *     state. `localLogout` clears the access token, the refresh token, the
 *     user, and flips `status` to `'anonymous'`; RequireAuth reacts to that
 *     by redirecting to /login on the next render.
 *   - The `storage` event is how tabs learn about each other. Only the
 *     refresh-token key is watched: another tab clearing it means "I logged
 *     out, follow me"; another tab writing a new one means "I logged in (or
 *     rotated), adopt it" so this tab doesn't keep racing a dead token.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { api, MOCK_AUTO_LOGIN } from '@/api';
import { IS_MOCK } from '@/lib/config';
import type { AuthSession } from '@/api/contract';
import type { AuthUser, Role } from '@/types/domain';
import { clearRefreshToken, readRefreshToken, saveRefreshToken, REFRESH_TOKEN_KEY } from './storage';
import { getAccessToken, setAccessToken, setRefresher } from './tokenBridge';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthOutcome {
  success: boolean;
  message: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (username: string, password: string) => Promise<AuthOutcome>;
  loginWithGoogle: (idToken: string) => Promise<AuthOutcome>;
  logout: () => Promise<void>;
  hasRole: (role: Role) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh this many ms before the access token actually expires. */
const REFRESH_SKEW_MS = 60_000;
/** Never schedule a near-instant refresh loop if the server hands back a tiny TTL. */
const MIN_REFRESH_DELAY_MS = 5_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);
  // The refresh token this tab most recently wrote — lets the storage
  // listener tell "another tab changed it" apart from "I just changed it".
  const lastWrittenToken = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (expiresInSeconds: number) => {
      clearTimer();
      const delay = Math.max(expiresInSeconds * 1000 - REFRESH_SKEW_MS, MIN_REFRESH_DELAY_MS);
      refreshTimer.current = setTimeout(() => {
        void runRefresh();
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearTimer],
  );

  const localLogout = useCallback(() => {
    clearTimer();
    setAccessToken(null);
    clearRefreshToken();
    lastWrittenToken.current = null;
    setUser(null);
    setStatus('anonymous');
  }, [clearTimer]);

  const applySession = useCallback(
    (session: AuthSession) => {
      setAccessToken(session.tokens.accessToken);
      saveRefreshToken(session.tokens.refreshToken);
      lastWrittenToken.current = session.tokens.refreshToken;
      setUser(session.user);
      setStatus('authenticated');
      scheduleRefresh(session.tokens.expiresIn);
    },
    [scheduleRefresh],
  );

  /**
   * The only place a refresh call actually happens. Deduplicated: if a
   * refresh is already in flight, every caller shares that one promise
   * rather than firing a second network call for the same token.
   */
  const runRefresh = useCallback((): Promise<boolean> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const attempt = (async () => {
      const refreshToken = readRefreshToken();
      if (!refreshToken) {
        localLogout();
        return false;
      }
      try {
        const tokens = await api.auth.refresh(refreshToken);
        setAccessToken(tokens.accessToken);
        saveRefreshToken(tokens.refreshToken);
        lastWrittenToken.current = tokens.refreshToken;
        scheduleRefresh(tokens.expiresIn);
        return true;
      } catch {
        // Expired, revoked, or the server rejected it outright — the backend
        // rotates on every use, so a stale token is never coming back.
        localLogout();
        return false;
      }
    })();

    refreshInFlight.current = attempt.finally(() => {
      refreshInFlight.current = null;
    });
    return refreshInFlight.current;
  }, [localLogout, scheduleRefresh]);

  /** Refresh + fetch `/auth/me`. Used on boot and when another tab logs in. */
  const restoreSession = useCallback(async () => {
    if (!readRefreshToken()) {
      localLogout();
      return;
    }
    const refreshed = await runRefresh();
    if (!refreshed) return; // runRefresh already cleared everything

    try {
      const me = await api.auth.me();
      setUser(me);
      setStatus('authenticated');
    } catch {
      localLogout();
    }
  }, [localLogout, runRefresh]);

  // Boot restore: never flash the login page for a user who has a live
  // refresh token — `status` stays 'loading' until this settles.
  //
  // MOCK MODE SIGNS ITSELF IN. There is no password anywhere in this system
  // any more (access comes from an admin approving a device), so a login form
  // in local development would be asking for a credential that does not
  // exist. Instead the seeded ADMIN account is adopted on boot and `npm run
  // dev` drops straight into the app. This branch is dead in live builds.
  useEffect(() => {
    void (async () => {
      if (IS_MOCK && !readRefreshToken()) {
        const outcome = await api.auth.login(MOCK_AUTO_LOGIN.username, MOCK_AUTO_LOGIN.password);
        if (outcome.success && outcome.session) {
          applySession(outcome.session);
          return;
        }
      }
      await restoreSession();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register with the token bridge so http.ts can refresh-and-retry on a 401
  // from any ordinary API call, without importing this module directly.
  useEffect(() => {
    setRefresher(async () => {
      const ok = await runRefresh();
      return ok ? getAccessToken() : null;
    });
    return () => setRefresher(null);
  }, [runRefresh]);

  // Cross-tab sync: another tab clearing the refresh token means it logged
  // out (follow it); another tab writing a new one means it logged in or
  // rotated ahead of us (adopt it, rather than let this tab keep using a
  // token the server has already replaced).
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== REFRESH_TOKEN_KEY) return;
      if (event.newValue === lastWrittenToken.current) return; // our own write

      if (event.newValue === null) {
        localLogout();
      } else {
        void restoreSession();
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [localLogout, restoreSession]);

  useEffect(() => clearTimer, [clearTimer]);

  const login = useCallback(
    async (username: string, password: string): Promise<AuthOutcome> => {
      const outcome = await api.auth.login(username, password);
      if (outcome.success && outcome.session) applySession(outcome.session);
      return { success: outcome.success, message: outcome.message };
    },
    [applySession],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string): Promise<AuthOutcome> => {
      const outcome = await api.auth.loginWithGoogle(idToken);
      if (outcome.success && outcome.session) applySession(outcome.session);
      return { success: outcome.success, message: outcome.message };
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const refreshToken = readRefreshToken();
    // Clear local state immediately — don't make the UI wait on the network,
    // and a failed logout call must never leave the user looking signed in.
    localLogout();
    await api.auth.logout(refreshToken).catch(() => {});
  }, [localLogout]);

  // ADMIN satisfies every gate. That mirrors the backend: SecurityConfig's
  // matrix lets ADMIN perform every business write, so an admin seeing only
  // the Admin section while being allowed to do everything would be a lie the
  // UI tells about the server.
  const hasRole = useCallback(
    (role: Role) => {
      if (!user) return false;
      return user.roles.includes(role) || user.roles.includes('ADMIN');
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, loginWithGoogle, logout, hasRole }),
    [user, status, login, loginWithGoogle, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>.');
  return ctx;
}
