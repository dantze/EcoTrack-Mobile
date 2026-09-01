/**
 * Where a signed-in employee lands, given the roles the admin granted them.
 *
 * Pulled out of the old login screen so that BOTH entry points agree: the boot
 * gate (`app/index.tsx`, restoring a stored session) and the enrollment screen
 * (`app/enrollment.tsx`, right after a request is approved). When these two
 * disagree, "restart the app" silently changes which screen you get.
 *
 * Deliberately dependency-free — no react-native, no expo-router — so it is
 * covered by the node-environment Vitest project. See vitest.config.ts.
 */

/** The four roles `EnrollmentService.ASSIGNABLE_ROLES` can grant, backend-side. */
export type Role = 'ADMIN' | 'SALES' | 'TECH' | 'DRIVER';

/** Romanian labels, matching web's `ROLE_LABELS`. */
export const ROLE_LABELS: Record<Role, string> = {
    ADMIN: 'Administrator',
    SALES: 'Vânzări',
    TECH: 'Tehnic',
    DRIVER: 'Șofer',
};

export const roleLabel = (role: string | null | undefined): string =>
    (role && ROLE_LABELS[role.toUpperCase() as Role]) || 'utilizator';

/**
 * ADMIN has no screens of its own in the mobile app — administration lives on
 * the web. What an admin holding the phone actually wants is to look at a
 * driver's day, which is exactly what DriverSelection does, so that is where
 * they go.
 */
const DESTINATIONS: Record<Role, string> = {
    DRIVER: '/Driver/DriverRoutes',
    SALES: '/Sales/Menu',
    TECH: '/Technical/Menu',
    ADMIN: '/Driver/DriverSelection',
};

export type Destination =
    /** Exactly one usable role: straight in. */
    | { kind: 'screen'; path: string }
    /** More than one: let the person pick which hat they are wearing today. */
    | { kind: 'roleSelection'; roles: Role[] }
    /**
     * Nothing this app can open. Either the request was approved with a role we
     * do not know, or — the case that actually happens — the roles list is
     * empty because the session predates enrollment.
     */
    | { kind: 'none'; message: string };

export const destinationForRoles = (roles: readonly string[] | null | undefined): Destination => {
    const known = (roles ?? [])
        .map((role) => role.toUpperCase())
        .filter((role): role is Role => role in DESTINATIONS);
    // A person granted the same role twice (or by two paths) is still one hat.
    const unique = Array.from(new Set(known));

    if (unique.length === 0) {
        return { kind: 'none', message: 'Utilizatorul nu are niciun rol asignat.' };
    }
    if (unique.length === 1) {
        return { kind: 'screen', path: DESTINATIONS[unique[0]] };
    }
    return { kind: 'roleSelection', roles: unique };
};
