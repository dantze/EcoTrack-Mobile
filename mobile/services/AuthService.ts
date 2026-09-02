import { API_BASE_URL } from '../constants/ApiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearTokens, getRefreshToken, setTokens } from './tokenStore';
import { clearPendingTicket } from './enrollmentStorage';
import { apiFetch } from './http';
import { normalizeUser, rolesEqual, type RawUser, type User } from './userModel';

/**
 * The session this device holds, and what it is allowed to do with it.
 *
 * There is no `login` here any more: `/api/auth/login` was deleted backend-side
 * along with passwords. A device gets its first session from
 * `EnrollmentService.claim()` once an admin has approved its access request,
 * and hands it here via `adoptSession`. Everything below operates on a session
 * that already exists.
 */

/**
 * The user shape lives in `userModel.ts` now, with the normaliser that builds
 * it (TODO-35), and is re-exported so every existing
 * `import { AuthService, User } from './AuthService'` keeps working.
 */
export type { User } from './userModel';

/** What {@link AuthService.syncCurrentUser} reports back. */
export interface UserSync {
    /** The employee as the server currently sees them. */
    user: User;
    /**
     * True when the ROLES differ from the copy this device had. The caller
     * re-routes on this: the menus are drawn from the cached roles, so a change
     * means what is on screen no longer matches what the backend authorises.
     */
    rolesChanged: boolean;
}

/** What a successful enrollment claim yields: who you are, plus the token pair. */
export interface AuthSession {
    user: User;
    tokens: { accessToken: string; refreshToken: string };
}

const USER_STORAGE_KEY = '@ecotrack_user';
const ACTIVE_DRIVER_KEY = '@ecotrack_active_driver';

export const AuthService = {
    /**
     * Takes ownership of a freshly issued session.
     *
     * Tokens go in first: a screen that navigates on the promise returned here
     * must never make its first API call before the access token is readable.
     * Any impersonated driver from a previous session is dropped, because this
     * is a different person on the same phone.
     */
    adoptSession: async (session: AuthSession): Promise<void> => {
        await setTokens(session.tokens);
        try {
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.user));
            await AsyncStorage.removeItem(ACTIVE_DRIVER_KEY);
        } catch (error) {
            console.error('Error persisting the session:', error);
        }
    },

    /**
     * Re-reads the employee behind this device's token and rewrites the cached
     * copy (TODO-35).
     *
     * <b>The problem it solves.</b> `user.roles` was written once, at claim
     * time, and never refetched — so an admin promoting or demoting someone in
     * Angajați changed what the backend authorises but not what the phone
     * renders. The device kept drawing the old menus until it re-enrolled, and
     * the mismatch landed on the user as "button does nothing", or a 403.
     *
     * Never a privilege leak: authorization always reads the Employee the token
     * points at, never this copy. What the copy decides is which buttons exist.
     *
     * <b>It returns null rather than throwing, and the caller keeps the cache.</b>
     * A phone in a basement must not be sent back to enrollment because one GET
     * failed — the refresh token is what proves there is a session, and it is
     * still there. A token that is genuinely dead takes the other path: the
     * 401-refresh in `http.ts` fails, tokens are cleared, and the
     * session-expired hook lands the device on the enrollment screen.
     *
     * <b>And it gives up after `timeoutMs`, for the same reason.</b> The boot
     * gate awaits this before it renders anything, so an unanswered request
     * would hold a driver on the loading spinner for as long as the platform's
     * own socket timeout — which is exactly the situation (bad signal, on site)
     * where they most need the app to just open. The answer is a nicety; the
     * cached roles are the fallback, and they are what the app used to run on
     * indefinitely.
     */
    syncCurrentUser: async ({ timeoutMs = 6000 } = {}): Promise<UserSync | null> => {
        const cached = await AuthService.getCurrentUser();
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;

        try {
            // Raced rather than left to the signal alone: aborting asks the
            // platform's fetch to stop, and this guarantees the caller is
            // unblocked on the deadline whether or not it honours that.
            const timeout = new Promise<null>((resolve) => {
                timer = setTimeout(() => {
                    controller.abort();
                    resolve(null);
                }, timeoutMs);
            });
            const response = await Promise.race([
                apiFetch('/auth/me', { signal: controller.signal }),
                timeout,
            ]);
            if (!response || !response.ok) return null;

            const user = normalizeUser((await response.json()) as RawUser);
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            return { user, rolesChanged: !rolesEqual(cached?.roles, user.roles) };
        } catch (error) {
            console.error('Could not refresh the stored user:', error);
            return null;
        } finally {
            if (timer !== undefined) clearTimeout(timer);
        }
    },

    /**
     * Is there a session to restore on launch?
     *
     * The REFRESH token is what decides, not the access token: the access token
     * expires every 30 minutes and `apiFetch` renews it silently, so requiring
     * one would send a perfectly good device back to enrollment twice an hour.
     */
    hasStoredSession: async (): Promise<boolean> => {
        const [refreshToken, user] = await Promise.all([
            getRefreshToken(),
            AuthService.getCurrentUser(),
        ]);
        return Boolean(refreshToken && user);
    },

    /**
     * Get the currently logged in user
     */
    getCurrentUser: async (): Promise<User | null> => {
        try {
            const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
            if (userJson) {
                return JSON.parse(userJson);
            }
        } catch (error) {
            console.error('Error getting current user:', error);
        }
        return null;
    },

    /**
     * Logout the current user.
     *
     * Revokes the session server-side first. Clearing local storage alone would
     * leave the refresh token this device was issued valid for the rest of its
     * year (ecotrack.security.refresh-token-ttl-days), so a phone handed on or
     * lost after "Deconectare" would still be a way in.
     * Best-effort: a failed call must never trap someone in a signed-in state,
     * so the local clear happens either way.
     */
    logout: async (): Promise<void> => {
        try {
            const refreshToken = await getRefreshToken();
            if (refreshToken) {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                });
            }
        } catch (error) {
            console.error('Error revoking session on logout:', error);
        }

        await AuthService.forgetSession();
    },

    /**
     * Local-only teardown: drop everything this device knows about the session
     * without calling the server.
     *
     * Used when the server has ALREADY invalidated us — `http.ts` gives up on a
     * refresh — where a logout call would be a pointless request with a token
     * that is known dead. The pending enrollment ticket goes too, so the
     * enrollment screen the user lands on starts from the form rather than
     * polling a request that belongs to a session that no longer exists.
     */
    forgetSession: async (): Promise<void> => {
        await clearTokens();
        await clearPendingTicket();
        try {
            await AsyncStorage.multiRemove([USER_STORAGE_KEY, ACTIVE_DRIVER_KEY]);
        } catch (error) {
            console.error('Error clearing the stored session:', error);
        }
    },

    /**
     * Check if user has a specific role
     */
    hasRole: (user: User | null, role: string): boolean => {
        if (!user || !user.roles) return false;
        return user.roles.includes(role);
    },

    /**
     * Check if user is a driver
     */
    isDriver: (user: User | null): boolean => {
        return AuthService.hasRole(user, 'DRIVER');
    },

    /**
     * Check if user is sales or tech (office staff)
     */
    isOfficeStaff: (user: User | null): boolean => {
        return AuthService.hasRole(user, 'SALES') || AuthService.hasRole(user, 'TECH');
    },

    /**
     * Set the active driver (for admin impersonation)
     */
    setActiveDriver: async (driverId: number, driverName: string): Promise<void> => {
        await AsyncStorage.setItem(ACTIVE_DRIVER_KEY, JSON.stringify({ id: driverId, fullName: driverName }));
    },

    /**
     * Get the active driver (returns the impersonated driver, or null)
     */
    getActiveDriver: async (): Promise<{ id: number; fullName: string } | null> => {
        try {
            const json = await AsyncStorage.getItem(ACTIVE_DRIVER_KEY);
            if (json) {
                return JSON.parse(json);
            }
        } catch (error) {
            console.error('Error getting active driver:', error);
        }
        return null;
    },

    /**
     * Clear the active driver selection
     */
    clearActiveDriver: async (): Promise<void> => {
        await AsyncStorage.removeItem(ACTIVE_DRIVER_KEY);
    },
};
