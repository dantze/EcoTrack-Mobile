import { apiFetch } from './http';
import { AuthService, AuthSession, User } from './AuthService';
import {
    clearPendingTicket,
    getDeviceId,
    PendingTicket,
    readPendingTicket,
    savePendingTicket,
} from './enrollmentStorage';

/**
 * Device enrollment — the only way into the app now that passwords are gone.
 *
 * `/api/auth/login` no longer exists backend-side. Instead this device asks for
 * access, shows a six-digit code, and waits: an admin checks the code matches
 * what the person in front of them reads out, picks a role, and approves. Only
 * then can the device exchange its one-time claim secret for tokens.
 *
 * THREE VALUES, EASY TO CONFUSE (see backend `AccessRequest`):
 *   deviceId          self-asserted, a label for the admin, grants nothing
 *   verificationCode  shown here AND in the admin queue, so the admin can tell
 *                     the real requester from someone else's request
 *   claimSecret       the actual credential, returned once, stored locally,
 *                     single-use
 *
 * The claim endpoint answers with STATUS CODES, and three of them are ordinary
 * outcomes rather than faults — mirrored from `web/src/api/live/enrollment.ts`:
 *   200  approved, tokens issued
 *   202  still pending — this is what the waiting screen polls on
 *   403  an admin rejected it
 *   410  the window closed, or the secret was already spent
 *   404  unknown request id OR wrong secret (deliberately indistinguishable)
 *
 * Every call here is `anonymous` — see `ApiFetchOptions.anonymous` in http.ts
 * for why attaching a stale bearer token here would lock the device out.
 */

// -------------------------------------------------------------------- types

export interface EnrollmentStatus {
    /** True while nobody has claimed this instance: the first request wins ADMIN. */
    awaitingBootstrap: boolean;
    /** Show the setup-code field only when the server asks for it. */
    setupCodeRequired: boolean;
}

export interface EnrollmentTicket extends PendingTicket {
    /** Bootstrap request: already approved, so the very first poll will succeed. */
    autoApproved: boolean;
}

export type RequestResult =
    | { state: 'created'; ticket: EnrollmentTicket }
    | { state: 'error'; message: string };

export type ClaimResult =
    | { state: 'issued'; session: AuthSession }
    | { state: 'pending' }
    | { state: 'rejected'; message: string }
    | { state: 'expired'; message: string }
    | { state: 'unknown'; message: string };

export interface RequestAccessInput {
    fullName: string;
    /** Human-readable phone description for the admin's queue. */
    deviceLabel?: string;
    /** First run only; ignored by the server once an admin exists. */
    setupCode?: string;
}

// ------------------------------------------------------------------ helpers

const jsonBody = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

/** The backend's error bodies are `{ "message": "…" }`, already in Romanian. */
const messageFrom = async (response: Response, fallback: string): Promise<string> => {
    try {
        const data = await response.json();
        return typeof data?.message === 'string' && data.message ? data.message : fallback;
    } catch {
        return fallback;
    }
};

interface RawClaimUser {
    id?: number;
    username?: string;
    fullName?: string;
    phone?: string | null;
    county?: string | null;
    roles?: string[] | null;
}

const normalizeUser = (raw: RawClaimUser): User => ({
    id: raw.id ?? 0,
    username: raw.username ?? '',
    fullName: raw.fullName ?? '',
    phone: raw.phone ?? '',
    county: raw.county ?? null,
    roles: Array.isArray(raw.roles) ? raw.roles.map((role) => role.toUpperCase()) : [],
});

// ------------------------------------------------------------------ the API

export const EnrollmentService = {
    /**
     * GET /api/enrollment/status
     * → 200 `{ awaitingBootstrap: boolean, setupCodeRequired: boolean }`
     *
     * Lets the screen decide whether to render the setup-code field. Leaks
     * nothing beyond "has anyone claimed this server yet". Throws on a network
     * failure; the screen renders its default form in that case.
     */
    getStatus: async (): Promise<EnrollmentStatus> => {
        const response = await apiFetch('/enrollment/status', {}, { anonymous: true });
        if (!response.ok) {
            throw new Error(`Enrollment status failed with ${response.status}`);
        }
        const data = await response.json();
        return {
            awaitingBootstrap: data?.awaitingBootstrap === true,
            setupCodeRequired: data?.setupCodeRequired === true,
        };
    },

    /**
     * POST /api/enrollment/request
     * body `{ fullName, deviceId, deviceLabel, setupCode }`
     * → 200 `{ requestId, claimSecret, verificationCode, expiresAt, autoApproved }`
     * → 400 bad name/device · 403 wrong setup code · 429 rate limited
     *
     * On success the ticket is persisted before returning, so a restart while
     * waiting resumes the same request instead of asking the user to read out a
     * new code.
     */
    requestAccess: async (input: RequestAccessInput): Promise<RequestResult> => {
        const fullName = input.fullName.trim();
        if (!fullName) {
            return { state: 'error', message: 'Introdu numele complet' };
        }

        const deviceId = await getDeviceId();
        const response = await apiFetch(
            '/enrollment/request',
            jsonBody({
                fullName,
                deviceId,
                deviceLabel: input.deviceLabel ?? null,
                setupCode: input.setupCode?.trim() || null,
            }),
            { anonymous: true },
        );

        if (!response.ok) {
            const fallback =
                response.status === 403
                    ? 'Cod de configurare invalid'
                    : response.status === 429
                      ? 'Prea multe cereri. Încearcă din nou mai târziu.'
                      : response.status === 400
                        ? 'Nume sau dispozitiv invalid'
                        : 'Cererea nu a putut fi trimisă. Încearcă din nou.';
            return { state: 'error', message: await messageFrom(response, fallback) };
        }

        const data = await response.json();
        if (typeof data?.requestId !== 'number' || typeof data?.claimSecret !== 'string') {
            return { state: 'error', message: 'Răspuns invalid de la server.' };
        }

        const ticket: EnrollmentTicket = {
            requestId: data.requestId,
            claimSecret: data.claimSecret,
            verificationCode: String(data.verificationCode ?? ''),
            expiresAt: String(data.expiresAt ?? ''),
            autoApproved: data.autoApproved === true,
        };
        await savePendingTicket({
            requestId: ticket.requestId,
            claimSecret: ticket.claimSecret,
            verificationCode: ticket.verificationCode,
            expiresAt: ticket.expiresAt,
        });
        return { state: 'created', ticket };
    },

    /**
     * POST /api/enrollment/claim
     * body `{ requestId, claimSecret }`
     * → 200 LoginResponse `{ accessToken, refreshToken, expiresIn, user{…roles} }`
     * → 202 pending · 403 rejected · 410 expired/spent · 404 unknown
     *
     * On 200 the tokens and the user are adopted here, and the ticket is
     * deleted — a claim secret is single-use, so keeping it would only give a
     * later restart something dead to poll with.
     */
    claim: async (ticket: PendingTicket): Promise<ClaimResult> => {
        const response = await apiFetch(
            '/enrollment/claim',
            jsonBody({ requestId: ticket.requestId, claimSecret: ticket.claimSecret }),
            { anonymous: true },
        );

        if (response.status === 202) {
            return { state: 'pending' };
        }
        if (response.status === 403) {
            return { state: 'rejected', message: await messageFrom(response, 'Cererea a fost respinsă') };
        }
        if (response.status === 410) {
            return {
                state: 'expired',
                message: await messageFrom(response, 'Cererea a expirat. Trimite o cerere nouă.'),
            };
        }
        if (response.status === 404) {
            return { state: 'unknown', message: 'Cererea nu a fost găsită. Trimite o cerere nouă.' };
        }
        if (!response.ok) {
            // A 5xx is a fault, not a decision: the caller keeps polling.
            throw new Error(`Enrollment claim failed with ${response.status}`);
        }

        const data = await response.json();
        if (!data?.accessToken || !data?.refreshToken) {
            // Approved but token-less should be impossible; treat it as "keep
            // waiting" rather than dropping the user into a session with no
            // credentials.
            return { state: 'pending' };
        }

        const session: AuthSession = {
            user: normalizeUser(data.user ?? data),
            tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
        };
        await AuthService.adoptSession(session);
        await clearPendingTicket();
        return { state: 'issued', session };
    },

    /** The request this device is currently waiting on, if any. */
    getPendingTicket: (): Promise<PendingTicket | null> => readPendingTicket(),

    /** "Anulează", and every terminal outcome: forget the request entirely. */
    cancelPendingRequest: (): Promise<void> => clearPendingTicket(),
};
