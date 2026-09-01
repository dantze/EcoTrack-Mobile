import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistence for the two things enrollment needs to survive an app restart:
 * this device's id, and the request that is currently waiting for an admin.
 *
 * Kept apart from `tokenStore.ts` for the same acyclic reason that module
 * exists: `AuthService` clears the pending ticket on logout while
 * `EnrollmentService` writes it, and neither should have to import the other.
 * `web/src/auth/storage.ts` is the same module on the web side, down to the
 * shape of `PendingTicket`.
 *
 * Neither value is a credential in the sense the claim secret is — see below —
 * but the ticket DOES carry the claim secret, so it lives under the same
 * app-private (not encrypted) AsyncStorage as the tokens, and is deleted the
 * moment it has been spent.
 */

const DEVICE_ID_KEY = '@ecotrack_device_id';
const PENDING_TICKET_KEY = '@ecotrack_enrollment_ticket';

export interface PendingTicket {
    requestId: number;
    /** Returned by the server exactly once. Losing it means starting over. */
    claimSecret: string;
    /** The six digits the user reads out to the admin. */
    verificationCode: string;
    /** ISO-8601. After this the request is dead and a new one is needed. */
    expiresAt: string;
}

// ---------------------------------------------------------------- device id

let deviceIdCache: string | null = null;
let deviceIdInFlight: Promise<string> | null = null;

/**
 * Self-asserted and deliberately not random-enough-to-be-a-secret: the backend
 * treats `deviceId` as a label, never as an authorisation (see the class
 * comment on `AccessRequest`). What it must be is STABLE — the admin uses it to
 * tell a re-install apart from a new phone, and a device that mints a fresh id
 * every launch would flood the request queue.
 */
const mintDeviceId = (): string => {
    const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (typeof cryptoRef?.randomUUID === 'function') {
        return cryptoRef.randomUUID();
    }
    // Hermes has no global crypto on older runtimes. Uniqueness across this
    // fleet is all that is needed, and `Math.random` + the clock gives that.
    return `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

/** Reads the stored id, minting and persisting one on first launch. */
export const getDeviceId = async (): Promise<string> => {
    if (deviceIdCache) return deviceIdCache;
    // Single-flight: two screens asking at once must not mint two ids and race
    // each other's write.
    if (!deviceIdInFlight) {
        deviceIdInFlight = (async () => {
            try {
                const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
                if (stored) {
                    deviceIdCache = stored;
                    return stored;
                }
            } catch (error) {
                console.error('[enrollmentStorage] Could not read the device id:', error);
            }

            const minted = mintDeviceId();
            deviceIdCache = minted;
            try {
                await AsyncStorage.setItem(DEVICE_ID_KEY, minted);
            } catch (error) {
                // A per-launch id is worse than a stable one but better than none:
                // the request still works, the admin just sees a new device.
                console.error('[enrollmentStorage] Could not persist the device id:', error);
            }
            return minted;
        })().finally(() => {
            deviceIdInFlight = null;
        });
    }
    return deviceIdInFlight;
};

// ----------------------------------------------------------- pending ticket

/**
 * The in-flight request survives a restart on purpose: the user has read a
 * six-digit code out to an admin, and backgrounding the app (or Android killing
 * it) must not force them to start over with a different code.
 */
export const readPendingTicket = async (): Promise<PendingTicket | null> => {
    try {
        const raw = await AsyncStorage.getItem(PENDING_TICKET_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PendingTicket;
        return typeof parsed?.requestId === 'number' && typeof parsed?.claimSecret === 'string'
            ? parsed
            : null;
    } catch (error) {
        console.error('[enrollmentStorage] Could not read the pending request:', error);
        return null;
    }
};

export const savePendingTicket = async (ticket: PendingTicket): Promise<void> => {
    try {
        await AsyncStorage.setItem(PENDING_TICKET_KEY, JSON.stringify(ticket));
    } catch (error) {
        console.error('[enrollmentStorage] Could not persist the pending request:', error);
    }
};

export const clearPendingTicket = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(PENDING_TICKET_KEY);
    } catch (error) {
        console.error('[enrollmentStorage] Could not clear the pending request:', error);
    }
};
