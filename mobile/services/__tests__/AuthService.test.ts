import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `syncCurrentUser` is what makes a role change on the web reach the phone
 * (TODO-35). Before it, `user.roles` was written once at claim time and never
 * refetched, so a promotion or a demotion left the device drawing menus the
 * backend would refuse.
 *
 * The two rules worth pinning are the failure ones. A failed call must LEAVE
 * the cached user alone — a phone with no signal still holds a valid refresh
 * token, and wiping the cache would bounce it to enrollment for a lost packet.
 * And `rolesChanged` must be false when the same roles come back in a different
 * order or case, because the caller re-routes on it.
 *
 * Every native dependency is replaced with a `vi.mock` FACTORY, so the real
 * module is never loaded and AsyncStorage never reaches the transform chain.
 * See vitest.config.ts.
 */

const store = new Map<string, string>();
const apiFetch = vi.fn();

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
        multiRemove: async (keys: string[]) => {
            for (const key of keys) store.delete(key);
        },
    },
}));
vi.mock('../http', () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }));
vi.mock('../tokenStore', () => ({
    clearTokens: vi.fn(async () => {}),
    getRefreshToken: vi.fn(async () => 'refresh-token'),
    setTokens: vi.fn(async () => {}),
}));
vi.mock('../enrollmentStorage', () => ({ clearPendingTicket: vi.fn(async () => {}) }));

import { AuthService } from '../AuthService';
import { rolesEqual } from '../userModel';

const USER_KEY = '@ecotrack_user';

const reply = (status: number, body: unknown = {}): Response =>
    ({
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
    }) as unknown as Response;

const cacheUser = (roles: string[]) => {
    store.set(
        USER_KEY,
        JSON.stringify({
            id: 3,
            username: 'ion_popescu',
            fullName: 'Ion Popescu',
            phone: '',
            county: null,
            roles,
        }),
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
});

describe('syncCurrentUser', () => {
    it('reads the employee from GET /auth/me and rewrites the cached copy', async () => {
        cacheUser(['DRIVER']);
        apiFetch.mockResolvedValue(
            reply(200, {
                id: 3,
                username: 'ion_popescu',
                fullName: 'Ion Popescu',
                phone: null,
                county: null,
                roles: ['driver', 'sales'],
            }),
        );

        const synced = await AuthService.syncCurrentUser();

        // Carries an abort signal: the boot gate awaits this before it renders,
        // so the request has a deadline.
        expect(apiFetch).toHaveBeenCalledWith('/auth/me', {
            signal: expect.any(AbortSignal),
        });
        // Uppercased on the way in, like the claim path — the router compares
        // against 'SALES', so a lowercase role is a role the app does not have.
        expect(synced?.user.roles).toEqual(['DRIVER', 'SALES']);
        expect(synced?.rolesChanged).toBe(true);
        expect(await AuthService.getCurrentUser()).toMatchObject({ roles: ['DRIVER', 'SALES'] });
    });

    it('reports no change when the same roles come back in another order or case', async () => {
        cacheUser(['DRIVER', 'SALES']);
        apiFetch.mockResolvedValue(reply(200, { id: 3, roles: ['sales', 'driver'] }));

        const synced = await AuthService.syncCurrentUser();

        expect(synced?.rolesChanged).toBe(false);
    });

    it('keeps the cached user when the call fails, rather than signing the device out', async () => {
        cacheUser(['DRIVER']);
        apiFetch.mockRejectedValue(new Error('network down'));

        await expect(AuthService.syncCurrentUser()).resolves.toBeNull();

        // The refresh token still proves there is a session; a lost packet must
        // not cost the user their roles.
        expect(await AuthService.getCurrentUser()).toMatchObject({ roles: ['DRIVER'] });
    });

    it('keeps the cached user on a non-OK response too', async () => {
        cacheUser(['DRIVER']);
        apiFetch.mockResolvedValue(reply(401));

        await expect(AuthService.syncCurrentUser()).resolves.toBeNull();
        expect(await AuthService.getCurrentUser()).toMatchObject({ roles: ['DRIVER'] });
    });

    it('gives up on the deadline rather than holding the boot gate open', async () => {
        vi.useFakeTimers();
        cacheUser(['DRIVER']);
        // A request that never answers — bad signal, not a rejection.
        apiFetch.mockReturnValue(new Promise(() => {}));

        const pending = AuthService.syncCurrentUser({ timeoutMs: 5000 });
        await vi.advanceTimersByTimeAsync(5000);

        await expect(pending).resolves.toBeNull();
        expect(await AuthService.getCurrentUser()).toMatchObject({ roles: ['DRIVER'] });
        vi.useRealTimers();
    });

    it('treats a first sync with no cached user as a change', async () => {
        apiFetch.mockResolvedValue(reply(200, { id: 3, roles: ['ADMIN'] }));

        const synced = await AuthService.syncCurrentUser();

        expect(synced?.rolesChanged).toBe(true);
    });
});

describe('rolesEqual', () => {
    it('compares as sets, not as lists', () => {
        expect(rolesEqual(['ADMIN', 'SALES'], ['sales', 'admin'])).toBe(true);
        expect(rolesEqual(['ADMIN', 'ADMIN'], ['ADMIN'])).toBe(true);
        expect(rolesEqual(['ADMIN'], ['ADMIN', 'SALES'])).toBe(false);
        expect(rolesEqual([], [])).toBe(true);
        expect(rolesEqual(null, undefined)).toBe(true);
        expect(rolesEqual(null, ['DRIVER'])).toBe(false);
    });
});
