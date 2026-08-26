import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The device's copy of the current access/refresh token pair.
 *
 * Deliberately dependency-free. `http.ts` needs to read tokens on every
 * request and write them after a refresh, while `AuthService` needs to write
 * them at login and clear them at logout — if either owned the storage, the
 * two would import each other. This module is the seam that keeps that acyclic
 * (`web/src/auth/tokenBridge.ts` plays the same role on the web side).
 *
 * Both tokens live in AsyncStorage, which is app-private but *not* encrypted:
 * on a rooted/jailbroken device, or in an unencrypted device backup, the
 * refresh token is readable. That is the same trade the web app makes with
 * localStorage. `expo-secure-store` is the upgrade path and is not currently a
 * dependency; the mitigation that does exist is server-side — rotation on every
 * refresh with reuse detection, and a per-user session cap (see TokenService).
 */

const ACCESS_TOKEN_KEY = '@ecotrack_access_token';
const REFRESH_TOKEN_KEY = '@ecotrack_refresh_token';

export interface StoredTokens {
    accessToken: string;
    refreshToken: string;
}

type TokenCache = { accessToken: string | null; refreshToken: string | null };

// Read AsyncStorage once per app launch, then serve from memory: this is on the
// path of every single API call.
let cache: TokenCache | null = null;
let loading: Promise<TokenCache> | null = null;

const load = async (): Promise<TokenCache> => {
    if (cache) return cache;
    if (!loading) {
        loading = (async () => {
            try {
                const pairs = await AsyncStorage.multiGet([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
                const map = Object.fromEntries(pairs);
                cache = {
                    accessToken: map[ACCESS_TOKEN_KEY] ?? null,
                    refreshToken: map[REFRESH_TOKEN_KEY] ?? null,
                };
            } catch (error) {
                console.error('[tokenStore] Could not read stored tokens:', error);
                cache = { accessToken: null, refreshToken: null };
            } finally {
                loading = null;
            }
            return cache;
        })();
    }
    return loading;
};

export const getAccessToken = async (): Promise<string | null> => (await load()).accessToken;

export const getRefreshToken = async (): Promise<string | null> => (await load()).refreshToken;

export const setTokens = async (tokens: StoredTokens): Promise<void> => {
    // Update the cache first so a request racing this write cannot pick up the
    // token that was just rotated away — presenting it again looks like theft
    // to the backend and revokes the whole session.
    cache = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    try {
        await AsyncStorage.multiSet([
            [ACCESS_TOKEN_KEY, tokens.accessToken],
            [REFRESH_TOKEN_KEY, tokens.refreshToken],
        ]);
    } catch (error) {
        console.error('[tokenStore] Could not persist tokens:', error);
    }
};

export const clearTokens = async (): Promise<void> => {
    cache = { accessToken: null, refreshToken: null };
    try {
        await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    } catch (error) {
        console.error('[tokenStore] Could not clear tokens:', error);
    }
};
