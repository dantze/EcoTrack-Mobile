/**
 * The employee this device is signed in as, and how to read one off the wire.
 *
 * Pulled out of `AuthService` so BOTH places that receive a user from the
 * backend normalise it identically (TODO-35): `EnrollmentService.claim`, which
 * gets one with the token pair, and `AuthService.syncCurrentUser`, which
 * re-reads it from `GET /api/auth/me`. Two normalisers would mean the roles
 * stored at claim time and the roles stored on a refresh could differ in case
 * alone, and `destinationForRoles` would route differently after a restart.
 *
 * Deliberately dependency-free — no react-native, no AsyncStorage — so it runs
 * under the node-environment Vitest project with no mocking. Same arrangement,
 * and the same reason, as `roleRouting.ts`.
 */

export interface User {
    id: number;
    username: string;
    fullName: string;
    phone: string;
    county: string | null;
    roles: string[];
}

/** The employee as the backend serialises it (EmployeeResponse / LoginResponse). */
export interface RawUser {
    id?: number;
    username?: string;
    fullName?: string;
    phone?: string | null;
    county?: string | null;
    roles?: string[] | null;
}

/**
 * Roles are UPPERCASED here and nowhere else.
 *
 * `destinationForRoles` and `AuthService.hasRole` both compare against
 * 'ADMIN' / 'SALES' / 'TECH' / 'DRIVER', so a lowercase role coming off the
 * wire is a role the app silently does not have.
 */
export const normalizeUser = (raw: RawUser): User => ({
    id: raw.id ?? 0,
    username: raw.username ?? '',
    fullName: raw.fullName ?? '',
    phone: raw.phone ?? '',
    county: raw.county ?? null,
    roles: Array.isArray(raw.roles) ? raw.roles.map((role) => role.toUpperCase()) : [],
});

/**
 * Do these two role lists grant the same thing?
 *
 * Set semantics, not list equality: order is whatever the backend's `Set`
 * iterated in, and a duplicate is still one hat. A false "changed" here would
 * bounce the user back through the boot gate for nothing.
 */
export const rolesEqual = (
    left: readonly string[] | null | undefined,
    right: readonly string[] | null | undefined,
): boolean => {
    const a = new Set((left ?? []).map((role) => role.toUpperCase()));
    const b = new Set((right ?? []).map((role) => role.toUpperCase()));
    if (a.size !== b.size) return false;
    for (const role of a) {
        if (!b.has(role)) return false;
    }
    return true;
};
