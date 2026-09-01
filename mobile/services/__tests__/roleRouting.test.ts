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
        expect(destinationForRoles(['SALES'])).toEqual({ kind: 'screen', path: '/Sales/Menu' });
        expect(destinationForRoles(['TECH'])).toEqual({ kind: 'screen', path: '/Technical/Menu' });
    });

    // The first person to enroll is auto-granted ADMIN and nothing else, so
    // this is the very first screen the very first user ever sees.
    it('sends an ADMIN-only employee to the driver picker', () => {
        expect(destinationForRoles(['ADMIN'])).toEqual({
            kind: 'screen',
            path: '/Driver/DriverSelection',
        });
    });

    it('asks which hat when there is more than one role', () => {
        expect(destinationForRoles(['DRIVER', 'SALES'])).toEqual({
            kind: 'roleSelection',
            roles: ['DRIVER', 'SALES'],
        });
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
