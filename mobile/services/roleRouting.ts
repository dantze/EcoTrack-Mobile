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
 * The two roles this app still has screens for (TODO-33).
 *
 * SALES and TECH are deliberately absent. Their sections were deleted: every
 * order-type change used to be written twice, once here and once in `web/`,
 * and the web implementation is the more complete of the two. Office staff use
 * the responsive web app on the same phone.
 *
 * ADMIN has no screens of its own either — administration lives on the web —
 * but an admin holding the phone wants to look at a driver's day, which is
 * exactly what DriverSelection does.
 */
const DESTINATIONS = {
    DRIVER: '/Driver/DriverRoutes',
    ADMIN: '/Driver/DriverSelection',
} as const satisfies Partial<Record<Role, string>>;

type AppRole = keyof typeof DESTINATIONS;

/** Roles the backend grants that this app deliberately does not serve. */
const OFFICE_ROLES: readonly Role[] = ['SALES', 'TECH'];

export type Destination =
    /** Exactly one usable role: straight in. */
    | { kind: 'screen'; path: string }
    /** More than one: let the person pick which hat they are wearing today. */
    | { kind: 'roleSelection'; roles: AppRole[] }
    /**
     * A real role, correctly granted, that this app no longer serves: SALES or
     * TECH and nothing else (TODO-33).
     *
     * Kept apart from `none` because the two want opposite handling. This is
     * not a broken session — the person is who they say they are and the token
     * works — so the device keeps it and is pointed at the web app. Dropping
     * the session here would send a salesperson round the enrollment loop on
     * every launch, needing an admin each time, to be told the same thing.
     */
    | { kind: 'office'; roles: Role[] }
    /**
     * Nothing this app can open. Either the request was approved with a role we
     * do not know, or — the case that actually happens — the roles list is
     * empty because the session predates enrollment.
     */
    | { kind: 'none'; message: string };

export const destinationForRoles = (roles: readonly string[] | null | undefined): Destination => {
    const upper = (roles ?? []).map((role) => role.toUpperCase());
    const known = upper.filter((role): role is AppRole => role in DESTINATIONS);
    // A person granted the same role twice (or by two paths) is still one hat.
    const unique = Array.from(new Set(known));

    if (unique.length === 0) {
        const office = Array.from(
            new Set(upper.filter((role): role is Role => OFFICE_ROLES.includes(role as Role))),
        );
        if (office.length > 0) return { kind: 'office', roles: office };
        return { kind: 'none', message: 'Utilizatorul nu are niciun rol asignat.' };
    }
    if (unique.length === 1) {
        return { kind: 'screen', path: DESTINATIONS[unique[0]] };
    }
    return { kind: 'roleSelection', roles: unique };
};
