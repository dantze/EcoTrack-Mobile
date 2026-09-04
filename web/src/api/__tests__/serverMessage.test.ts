import { describe, expect, it } from 'vitest';
import { ApiError, serverMessage } from '../http';
import { errorMessage as technicalMessage } from '@/features/technical/utils';
import { errorMessage as salesMessage } from '@/features/sales/components/Toaster';

/**
 * TODO-51: the backend writes its refusals in Romanian, for the operator. The
 * web app used to answer every one of them with "Cererea a eșuat (cod 409)".
 *
 * The rule lives in `serverMessage` and nowhere else — the two `errorMessage`
 * functions below are the only phrasing layers, and a third copy on a screen is
 * the thing this replaces.
 */

/** The four-key envelope `GlobalExceptionHandler.body()` actually sends. */
function envelope(status: number, error: string, message: string): string {
  return JSON.stringify({
    timestamp: '2026-09-03T10:00:00Z',
    status,
    error,
    message,
  });
}

const INSUFFICIENT = 'Cantitate insuficientă la locație. Disponibil: 3, solicitat: 5.';

function apiError(status: number, body: string): ApiError {
  return new ApiError(`POST /orders failed with ${status}`, status, body);
}

describe('serverMessage', () => {
  it('reads `message` out of the error envelope', () => {
    const error = apiError(409, envelope(409, 'Insufficient Quantity', INSUFFICIENT));
    expect(serverMessage(error)).toBe(INSUFFICIENT);
  });

  it('accepts a bare plain-text body', () => {
    expect(serverMessage(apiError(404, 'Ruta nu a fost găsită'))).toBe('Ruta nu a fost găsită');
  });

  it('never surfaces the deliberately generic 401/403 text', () => {
    // Generic ON PURPOSE — echoing it would tell an unauthorized caller which
    // rule stopped them.
    const forbidden = apiError(403, envelope(403, 'Forbidden', 'Access denied: insufficient permissions.'));
    expect(serverMessage(forbidden)).toBeNull();
  });

  it('never surfaces a 5xx body', () => {
    const failure = envelope(500, 'Internal Server Error', 'An unexpected error occurred. Please try again later.');
    expect(serverMessage(apiError(500, failure))).toBeNull();
  });

  it('declines the English strings Spring itself raises on an allowlisted status', () => {
    const malformed = apiError(400, envelope(400, 'Bad Request', 'Malformed request body.'));
    const invalid = apiError(400, envelope(400, 'Validation Failed', 'Request validation failed. Check field details.'));
    expect(serverMessage(malformed)).toBeNull();
    expect(serverMessage(invalid)).toBeNull();
  });

  it('declines an empty body, an unreadable envelope and a proxy error page', () => {
    expect(serverMessage(apiError(409, ''))).toBeNull();
    expect(serverMessage(apiError(409, '{"message":'))).toBeNull();
    expect(serverMessage(apiError(404, '<!doctype html><title>404</title>'))).toBeNull();
  });

  it('declines an envelope whose message is missing or blank', () => {
    expect(serverMessage(apiError(409, JSON.stringify({ status: 409 })))).toBeNull();
    expect(serverMessage(apiError(409, JSON.stringify({ message: '   ' })))).toBeNull();
  });

  it('ignores anything that is not an ApiError', () => {
    expect(serverMessage(new Error('boom'))).toBeNull();
    expect(serverMessage('boom')).toBeNull();
    expect(serverMessage(null)).toBeNull();
  });
});

describe('errorMessage surfaces the refusal instead of the status code', () => {
  const retiredPlan = apiError(
    409,
    envelope(409, 'Conflict', 'Abonamentul „Lunar” a fost dezactivat și nu mai poate primi comenzi.'),
  );

  it('technical: shows the server sentence', () => {
    expect(technicalMessage(retiredPlan)).toBe(
      'Abonamentul „Lunar” a fost dezactivat și nu mai poate primi comenzi.',
    );
  });

  it('technical: falls back to the status when the body says nothing usable', () => {
    expect(technicalMessage(apiError(409, ''))).toBe('Cererea a eșuat (cod 409).');
  });

  it('technical: the admin 403 message still wins over anything the server sent', () => {
    const forbidden = apiError(403, envelope(403, 'Forbidden', 'Access denied: insufficient permissions.'));
    expect(technicalMessage(forbidden)).toContain('drepturi de administrator');
  });

  it('sales: shows the server sentence alone, without the fallback in front', () => {
    expect(salesMessage(retiredPlan, 'Nu s-a putut salva comanda')).toBe(
      'Abonamentul „Lunar” a fost dezactivat și nu mai poate primi comenzi.',
    );
  });

  it('sales: an ApiError with no usable body no longer pastes the request line', () => {
    // Was "Nu s-a putut salva comanda: POST /orders failed with 409".
    expect(salesMessage(apiError(409, ''), 'Nu s-a putut salva comanda')).toBe(
      'Nu s-a putut salva comanda (cod 409).',
    );
  });

  it('sales: a mock error still reads as its own message', () => {
    expect(salesMessage(new Error('Comanda are deja un task asociat'), 'Nu s-a putut salva comanda')).toBe(
      'Nu s-a putut salva comanda: Comanda are deja un task asociat',
    );
  });
});

/**
 * TODO-76: `AdminController` used to hand-roll its own error shapes, and the
 * one that mattered most was `createEmployee`'s.
 *
 * These two cases are the before and after of the same refusal. They are kept
 * together because the old shape is the thing to recognise: it looks like a
 * perfectly reasonable error body, it is JSON, it has the message in it — and
 * `serverMessage` returns null for it, because the key is `error` and not
 * `message`. The screen then showed its generic fallback and the admin was told
 * nothing about why the create failed.
 */
describe('the duplicate-username refusal reaches the operator', () => {
  const TAKEN = 'Există deja un angajat cu numele de utilizator „ion.popescu”.';

  it('the standard envelope carries it through', () => {
    const conflict = apiError(400, envelope(400, 'Bad Request', TAKEN));
    expect(serverMessage(conflict)).toBe(TAKEN);
  });

  it("the shape it used to send is still unreadable, which is why it changed", () => {
    // {"error": "..."} — no `message` key at all.
    const oldShape = apiError(400, JSON.stringify({ error: TAKEN }));
    expect(serverMessage(oldShape)).toBeNull();
  });

  it('so the admin screen now shows the reason instead of a generic failure', () => {
    const conflict = apiError(400, envelope(400, 'Bad Request', TAKEN));
    expect(technicalMessage(conflict)).toBe(TAKEN);
    expect(technicalMessage(apiError(400, JSON.stringify({ error: TAKEN })))).toBe(
      'Cererea a eșuat (cod 400).',
    );
  });
});
