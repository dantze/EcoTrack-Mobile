import { describe, expect, it } from 'vitest';
import { destinationForRoles, roleLabel } from '../roleRouting';

/**
 * The boot gate and the enrollment screen both route through this, so a
 * disagreement here shows up as "restarting the app takes me somewhere else".
 */
describe('destinationForRoles', () => {
    it('sends a single-role employee straight to their screen', () => {
        expect(destinationForRoles(['DRIVER'])).toEqual({
            kind: 'screen',
            path: '/Driver/DriverRoutes',
        });
    });

    // The first person to enroll is auto-granted ADMIN and nothing else, so
    // this is the very first screen the very first user ever sees.
    it('sends an ADMIN-only employee to the driver picker', () => {
        expect(destinationForRoles(['ADMIN'])).toEqual({
            kind: 'screen',
            path: '/Driver/DriverSelection',
        });
    });

    it('asks which hat when there is more than one role this app serves', () => {
        expect(destinationForRoles(['DRIVER', 'ADMIN'])).toEqual({
            kind: 'roleSelection',
            roles: ['DRIVER', 'ADMIN'],
        });
    });

    /**
     * TODO-33 deleted the Sales and Technical sections. SALES and TECH are
     * still real roles the backend grants — they just have no screens here, so
     * they must not count towards the picker and must not look like a broken
     * session either.
     */
    it('does not offer a hat for a role whose section moved to the web', () => {
        expect(destinationForRoles(['DRIVER', 'SALES'])).toEqual({
            kind: 'screen',
            path: '/Driver/DriverRoutes',
        });
        expect(destinationForRoles(['SALES'])).toEqual({ kind: 'office', roles: ['SALES'] });
        expect(destinationForRoles(['TECH', 'sales'])).toEqual({
            kind: 'office',
            roles: ['TECH', 'SALES'],
        });
    });

    it('separates "office only" from "no usable role", because one keeps the session', () => {
        // 'none' drops the session and sends the device back to enrollment,
        // which needs an admin. Doing that to a salesperson on every launch is
        // the bug the 'office' branch exists to avoid.
        expect(destinationForRoles(['SALES']).kind).toBe('office');
        expect(destinationForRoles(['WAREHOUSE']).kind).toBe('none');
    });

    it('is case-insensitive, matching what the backend may send', () => {
        expect(destinationForRoles(['driver'])).toEqual({
            kind: 'screen',
            path: '/Driver/DriverRoutes',
        });
    });

    it('treats a repeated role as one hat, not a picker', () => {
        expect(destinationForRoles(['DRIVER', 'driver'])).toEqual({
            kind: 'screen',
            path: '/Driver/DriverRoutes',
        });
    });

    it('ignores roles this app has no screens for', () => {
        expect(destinationForRoles(['DRIVER', 'WAREHOUSE'])).toEqual({
            kind: 'screen',
            path: '/Driver/DriverRoutes',
        });
    });

    it('reports "no role" for empty, null and entirely unknown lists', () => {
        for (const roles of [[], null, undefined, ['WAREHOUSE']]) {
            expect(destinationForRoles(roles).kind).toBe('none');
        }
    });
});

describe('roleLabel', () => {
    it('renders the Romanian label used in "Sunteți înregistrat cu rol de X"', () => {
        expect(roleLabel('DRIVER')).toBe('Șofer');
        expect(roleLabel('admin')).toBe('Administrator');
    });

    it('falls back rather than printing a raw role name at the user', () => {
        expect(roleLabel(null)).toBe('utilizator');
        expect(roleLabel('WAREHOUSE')).toBe('utilizator');
    });
});
