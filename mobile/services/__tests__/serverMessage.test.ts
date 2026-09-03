import { describe, expect, it, vi } from 'vitest';

/**
 * TODO-51: the backend writes its refusals in Romanian, for the driver. Every
 * `Eșec la …` throw site used to discard the response body and report its own
 * generic sentence instead.
 *
 * `tokenStore` is mocked with a FACTORY so the real AsyncStorage module never
 * loads — importing `http.ts` pulls it in. See vitest.config.ts.
 */
vi.mock('../tokenStore', () => ({
    getAccessToken: async () => null,
    getRefreshToken: async () => null,
    setTokens: async () => undefined,
    clearTokens: async () => undefined,
}));

import { apiError, messageFromBody } from '../http';

/** The four-key envelope `GlobalExceptionHandler.body()` actually sends. */
const envelope = (status: number, error: string, message: string): string =>
    JSON.stringify({ timestamp: '2026-09-03T10:00:00Z', status, error, message });

const failed = (status: number, body: string): Response =>
    ({
        status,
        ok: false,
        text: async () => body,
    }) as unknown as Response;

describe('messageFromBody', () => {
    it('reads `message` out of the error envelope', () => {
        const body = envelope(409, 'Conflict', 'Sarcina este deja finalizată.');
        expect(messageFromBody(409, body)).toBe('Sarcina este deja finalizată.');
    });

    it('accepts a bare plain-text body', () => {
        expect(messageFromBody(404, 'Sarcina nu a fost găsită')).toBe('Sarcina nu a fost găsită');
    });

    it('never surfaces the deliberately generic 401/403 text', () => {
        // Generic ON PURPOSE — echoing it would tell an unauthorized driver
        // which rule stopped them.
        const body = envelope(403, 'Forbidden', 'Access denied: insufficient permissions.');
        expect(messageFromBody(403, body)).toBeNull();
    });

    it('never surfaces a 5xx body', () => {
        const body = envelope(500, 'Internal Server Error', 'An unexpected error occurred. Please try again later.');
        expect(messageFromBody(500, body)).toBeNull();
    });

    it('declines the English strings Spring itself raises on an allowlisted status', () => {
        expect(messageFromBody(400, envelope(400, 'Bad Request', 'Malformed request body.'))).toBeNull();
        expect(
            messageFromBody(400, envelope(400, 'Validation Failed', 'Request validation failed. Check field details.')),
        ).toBeNull();
    });

    it('declines an empty body, an unreadable envelope and a proxy error page', () => {
        expect(messageFromBody(409, '')).toBeNull();
        expect(messageFromBody(409, '{"message":')).toBeNull();
        expect(messageFromBody(404, '<!doctype html><title>404</title>')).toBeNull();
    });
});

describe('apiError', () => {
    it('throws the server sentence when there is one', async () => {
        const body = envelope(409, 'Conflict', 'Sarcina este deja finalizată.');
        const error = await apiError(failed(409, body), 'Eșec la actualizarea stării sarcinii');
        expect(error.message).toBe('Sarcina este deja finalizată.');
    });

    it('falls back when the body says nothing usable', async () => {
        const error = await apiError(failed(409, ''), 'Eșec la actualizarea stării sarcinii');
        expect(error.message).toBe('Eșec la actualizarea stării sarcinii');
    });

    it('falls back rather than losing the failure when the body cannot be read', async () => {
        const unreadable = {
            status: 409,
            ok: false,
            text: async () => {
                throw new Error('stream already consumed');
            },
        } as unknown as Response;
        const error = await apiError(unreadable, 'Eșec la preluarea rutelor șoferului');
        expect(error.message).toBe('Eșec la preluarea rutelor șoferului');
    });
});
