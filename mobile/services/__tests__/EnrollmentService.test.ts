import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Enrollment is the only way into the app, so its failure modes are the ones
 * that lock a driver out of their route.
 *
 * Every native dependency is replaced with a `vi.mock` FACTORY, which means the
 * real module is never loaded and `@react-native-async-storage/async-storage`
 * never reaches the transform chain. See vitest.config.ts.
 */

const apiFetch = vi.fn();
const adoptSession = vi.fn();
const savePendingTicket = vi.fn();
const clearPendingTicket = vi.fn();
const readPendingTicket = vi.fn();
const getDeviceId = vi.fn();

vi.mock('../http', () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }));
vi.mock('../AuthService', () => ({
    AuthService: { adoptSession: (...args: any[]) => adoptSession(...args) },
}));
vi.mock('../enrollmentStorage', () => ({
    getDeviceId: () => getDeviceId(),
    readPendingTicket: () => readPendingTicket(),
    savePendingTicket: (...args: any[]) => savePendingTicket(...args),
    clearPendingTicket: () => clearPendingTicket(),
}));

import { EnrollmentService } from '../EnrollmentService';

/** Enough of a `Response` for the service, which only reads status + json(). */
const reply = (status: number, body: unknown = {}): Response =>
    ({
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
    }) as unknown as Response;

const TICKET = {
    requestId: 7,
    claimSecret: 'secret-xyz',
    verificationCode: '123456',
    expiresAt: '2026-09-01T10:00:00Z',
};

beforeEach(() => {
    vi.clearAllMocks();
    getDeviceId.mockResolvedValue('device-1');
});

describe('getStatus', () => {
    it('reads the two booleans the form renders from', async () => {
        apiFetch.mockResolvedValue(reply(200, { awaitingBootstrap: true, setupCodeRequired: true }));
        await expect(EnrollmentService.getStatus()).resolves.toEqual({
            awaitingBootstrap: true,
            setupCodeRequired: true,
        });
    });

    it('defaults both to false rather than trusting a partial body', async () => {
        apiFetch.mockResolvedValue(reply(200, {}));
        await expect(EnrollmentService.getStatus()).resolves.toEqual({
            awaitingBootstrap: false,
            setupCodeRequired: false,
        });
    });
});

describe('requestAccess', () => {
    it('sends the stored device id and persists the ticket before returning', async () => {
        apiFetch.mockResolvedValue(
            reply(200, {
                requestId: 7,
                claimSecret: 'secret-xyz',
                verificationCode: '123456',
                expiresAt: '2026-09-01T10:00:00Z',
                autoApproved: false,
            }),
        );

        const result = await EnrollmentService.requestAccess({
            fullName: '  Ion Popescu  ',
            deviceLabel: 'EcoTrack android 34',
        });

        expect(result).toEqual({ state: 'created', ticket: { ...TICKET, autoApproved: false } });
        expect(savePendingTicket).toHaveBeenCalledWith(TICKET);

        const [path, init] = apiFetch.mock.calls[0];
        expect(path).toBe('/enrollment/request');
        expect(JSON.parse(init.body)).toEqual({
            fullName: 'Ion Popescu',
            deviceId: 'device-1',
            deviceLabel: 'EcoTrack android 34',
            setupCode: null,
        });
    });

    // A stale bearer token on these endpoints is answered with a blanket 401 by
    // BearerTokenAuthenticationFilter, which would make the one screen that can
    // recover a revoked device the one screen it cannot reach.
    it('never attaches the Authorization header', async () => {
        apiFetch.mockResolvedValue(reply(200, { requestId: 1, claimSecret: 's' }));
        await EnrollmentService.requestAccess({ fullName: 'Ana' });
        expect(apiFetch.mock.calls[0][2]).toEqual({ anonymous: true });
    });

    it('rejects an empty name without calling the server', async () => {
        await expect(EnrollmentService.requestAccess({ fullName: '   ' })).resolves.toEqual({
            state: 'error',
            message: 'Introdu numele complet',
        });
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it("passes the setup code through, trimmed, on a fresh instance", async () => {
        apiFetch.mockResolvedValue(reply(200, { requestId: 1, claimSecret: 's' }));
        await EnrollmentService.requestAccess({ fullName: 'Ana', setupCode: ' ABCD-2345 ' });
        expect(JSON.parse(apiFetch.mock.calls[0][1].body).setupCode).toBe('ABCD-2345');
    });

    it("surfaces the server's Romanian message for each refusal", async () => {
        const cases: [number, string][] = [
            [400, 'Nume sau dispozitiv invalid'],
            [403, 'Cod de configurare invalid'],
            [429, 'Prea multe cereri. Încearcă din nou mai târziu.'],
        ];
        for (const [status, message] of cases) {
            apiFetch.mockResolvedValue(reply(status, { message }));
            await expect(EnrollmentService.requestAccess({ fullName: 'Ana' })).resolves.toEqual({
                state: 'error',
                message,
            });
        }
        expect(savePendingTicket).not.toHaveBeenCalled();
    });

    it('falls back to its own Romanian text when the body carries none', async () => {
        apiFetch.mockResolvedValue(reply(403, {}));
        await expect(EnrollmentService.requestAccess({ fullName: 'Ana' })).resolves.toEqual({
            state: 'error',
            message: 'Cod de configurare invalid',
        });
    });

    it('refuses a 200 that is missing the claim secret instead of storing a dead ticket', async () => {
        apiFetch.mockResolvedValue(reply(200, { requestId: 7 }));
        const result = await EnrollmentService.requestAccess({ fullName: 'Ana' });
        expect(result.state).toBe('error');
        expect(savePendingTicket).not.toHaveBeenCalled();
    });
});

describe('claim', () => {
    it('adopts the session and spends the ticket on 200', async () => {
        apiFetch.mockResolvedValue(
            reply(200, {
                accessToken: 'a',
                refreshToken: 'r',
                expiresIn: 1800,
                user: {
                    id: 3,
                    username: 'ion_popescu',
                    fullName: 'Ion Popescu',
                    phone: null,
                    county: null,
                    roles: ['driver'],
                },
            }),
        );

        const result = await EnrollmentService.claim(TICKET);

        expect(result).toEqual({
            state: 'issued',
            session: {
                user: {
                    id: 3,
                    username: 'ion_popescu',
                    fullName: 'Ion Popescu',
                    phone: '',
                    county: null,
                    roles: ['DRIVER'],
                },
                tokens: { accessToken: 'a', refreshToken: 'r' },
            },
        });
        expect(adoptSession).toHaveBeenCalledTimes(1);
        // Single-use: keeping it would only give a later restart something dead
        // to poll with.
        expect(clearPendingTicket).toHaveBeenCalledTimes(1);
    });

    // 202 is an ordinary outcome, not a fault — it is what the waiting screen
    // polls on, so it must never clear the ticket or throw.
    it('reports 202 as pending and leaves the ticket alone', async () => {
        apiFetch.mockResolvedValue(reply(202, { status: 'PENDING' }));
        await expect(EnrollmentService.claim(TICKET)).resolves.toEqual({ state: 'pending' });
        expect(clearPendingTicket).not.toHaveBeenCalled();
        expect(adoptSession).not.toHaveBeenCalled();
    });

    it('maps every terminal status to a Romanian message', async () => {
        apiFetch.mockResolvedValue(reply(403, { message: 'Cererea a fost respinsă' }));
        await expect(EnrollmentService.claim(TICKET)).resolves.toEqual({
            state: 'rejected',
            message: 'Cererea a fost respinsă',
        });

        apiFetch.mockResolvedValue(reply(410, { message: 'Cererea a expirat. Trimite o cerere nouă.' }));
        await expect(EnrollmentService.claim(TICKET)).resolves.toEqual({
            state: 'expired',
            message: 'Cererea a expirat. Trimite o cerere nouă.',
        });

        // 404 is "unknown id OR wrong secret", deliberately indistinguishable.
        apiFetch.mockResolvedValue(reply(404, { status: 'UNKNOWN' }));
        expect((await EnrollmentService.claim(TICKET)).state).toBe('unknown');
    });

    it('throws on a 5xx so the poll retries instead of ending the wait', async () => {
        apiFetch.mockResolvedValue(reply(503, {}));
        await expect(EnrollmentService.claim(TICKET)).rejects.toThrow();
        expect(clearPendingTicket).not.toHaveBeenCalled();
    });

    it('treats an approved-but-token-less 200 as still pending', async () => {
        apiFetch.mockResolvedValue(reply(200, { success: true }));
        await expect(EnrollmentService.claim(TICKET)).resolves.toEqual({ state: 'pending' });
        expect(adoptSession).not.toHaveBeenCalled();
    });

    it('sends only the id and the secret, anonymously', async () => {
        apiFetch.mockResolvedValue(reply(202, {}));
        await EnrollmentService.claim(TICKET);
        const [path, init, options] = apiFetch.mock.calls[0];
        expect(path).toBe('/enrollment/claim');
        expect(JSON.parse(init.body)).toEqual({ requestId: 7, claimSecret: 'secret-xyz' });
        expect(options).toEqual({ anonymous: true });
    });
});
