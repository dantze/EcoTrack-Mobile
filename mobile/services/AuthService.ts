import { API_BASE_URL } from '../constants/ApiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearTokens, getRefreshToken, setTokens } from './tokenStore';
import { clearPendingTicket } from './enrollmentStorage';

/**
 * The session this device holds, and what it is allowed to do with it.
 *
 * There is no `login` here any more: `/api/auth/login` was deleted backend-side
 * along with passwords. A device gets its first session from
 * `EnrollmentService.claim()` once an admin has approved its access request,
 * and hands it here via `adoptSession`. Everything below operates on a session
 * that already exists.
 */

export interface User {
    id: number;
    username: string;
    fullName: string;
    phone: string;
    county: string | null;
    roles: string[];
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
     * leave the refresh token this device was issued valid for another 60 days,
     * so a phone handed on or lost after "Deconectare" would still be a way in.
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
