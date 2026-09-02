import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `apiFetch` is the only door to the API, and two of its rules are load-bearing
 * enough to pin:
 *
 *  - **Which 401s are worth retrying.** A 401 from `/auth/refresh` or
 *    `/auth/logout` means the refresh token itself is wrong, and no retry can
 *    fix it. A 401 from anything else — `GET /auth/me` included — is just an
 *    expired access token. This used to exclude ALL of `/auth/**`, which made
 *    the boot gate's role sync (TODO-35) give up on every launch, since the
 *    stored access token is nearly always past its 30-minute life by then.
 *  - **`anonymous` sends no token at all**, which is what keeps the enrollment
 *    screens reachable from a device holding a revoked one.
 *
 * `tokenStore` is mocked with a FACTORY so the real AsyncStorage module never
 * loads. See vitest.config.ts.
 */

const getAccessToken = vi.fn();
const getRefreshToken = vi.fn();
const setTokens = vi.fn();
const clearTokens = vi.fn();

vi.mock('../tokenStore', () => ({
    getAccessToken: () => getAccessToken(),
    getRefreshToken: () => getRefreshToken(),
    setTokens: (...args: any[]) => setTokens(...args),
    clearTokens: () => clearTokens(),
}));

import { API_BASE_URL } from '../../constants/ApiConfig';
import { apiFetch, setOnSessionExpired, setOnSessionRenewed } from '../http';

const reply = (status: number, body: unknown = {}): Response =>
    ({
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
    }) as unknown as Response;

const fetchMock = vi.fn();

/** The Authorization header of the nth fetch call, or null if there was none. */
const authHeaderOf = (call: number): string | null => {
    const init = fetchMock.mock.calls[call]?.[1] as RequestInit | undefined;
    return init?.headers ? new Headers(init.headers).get('Authorization') : null;
};

beforeEach(() => {
    vi.clearAllMocks();
    setOnSessionExpired(null);
    setOnSessionRenewed(null);
    vi.stubGlobal('fetch', fetchMock);
    getAccessToken.mockResolvedValue('access-old');
    getRefreshToken.mockResolvedValue('refresh-1');
});

describe('apiFetch', () => {
    it('attaches the stored access token', async () => {
        fetchMock.mockResolvedValue(reply(200));

        await apiFetch('/tasks/12');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/tasks/12`);
        expect(authHeaderOf(0)).toBe('Bearer access-old');
    });

    it('sends nothing at all when anonymous, and never refreshes', async () => {
        fetchMock.mockResolvedValue(reply(401));

        await apiFetch('/enrollment/status', {}, { anonymous: true });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(authHeaderOf(0)).toBeNull();
    });

    it('refreshes once on a 401 and retries with the new token', async () => {
        fetchMock
            .mockResolvedValueOnce(reply(401))
            .mockResolvedValueOnce(reply(200, { accessToken: 'access-new', refreshToken: 'refresh-2' }))
            .mockResolvedValueOnce(reply(200));

        const response = await apiFetch('/tasks/12');

        expect(response.status).toBe(200);
        expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/refresh`);
        expect(authHeaderOf(2)).toBe('Bearer access-new');
        expect(setTokens).toHaveBeenCalledWith({
            accessToken: 'access-new',
            refreshToken: 'refresh-2',
        });
    });

    /** TODO-35: the boot gate's role sync depends on this one. */
    it('refreshes and retries GET /auth/me like any other read', async () => {
        fetchMock
            .mockResolvedValueOnce(reply(401))
            .mockResolvedValueOnce(reply(200, { accessToken: 'access-new', refreshToken: 'refresh-2' }))
            .mockResolvedValueOnce(reply(200, { id: 3, roles: ['DRIVER'] }));

        const response = await apiFetch('/auth/me');

        expect(response.status).toBe(200);
        expect(authHeaderOf(2)).toBe('Bearer access-new');
    });

    it('does not retry the two endpoints that authenticate with the refresh token', async () => {
        fetchMock.mockResolvedValue(reply(401));

        await apiFetch('/auth/refresh');
        await apiFetch('/auth/logout');

        // One call each: their 401 is the caller's to render.
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('clears the tokens and reports the session gone when the refresh is rejected', async () => {
        const expired = vi.fn();
        setOnSessionExpired(expired);
        fetchMock.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(401));

        await apiFetch('/tasks/12');

        expect(clearTokens).toHaveBeenCalledOnce();
        expect(expired).toHaveBeenCalledOnce();
    });

    it('announces a renewed session so the cached roles can be re-read (TODO-35)', async () => {
        const renewed = vi.fn();
        setOnSessionRenewed(renewed);
        fetchMock
            .mockResolvedValueOnce(reply(401))
            .mockResolvedValueOnce(reply(200, { accessToken: 'access-new', refreshToken: 'refresh-2' }))
            .mockResolvedValueOnce(reply(200));

        await apiFetch('/tasks/12');

        expect(renewed).toHaveBeenCalledOnce();
    });

    it('does not announce it for /auth/me itself — that request IS the handler', async () => {
        const renewed = vi.fn();
        setOnSessionRenewed(renewed);
        fetchMock
            .mockResolvedValueOnce(reply(401))
            .mockResolvedValueOnce(reply(200, { accessToken: 'access-new', refreshToken: 'refresh-2' }))
            .mockResolvedValueOnce(reply(200, {}));

        await apiFetch('/auth/me');

        expect(renewed).not.toHaveBeenCalled();
    });
});
