import { describe, it, expect } from 'vitest';
import { toDateString, formatDisplayDate, formatDateString } from '../dateUtils';

/** TZ is pinned to Europe/Bucharest by vitest.config.ts — see the note there. */

describe('toDateString', () => {
    it('produces the YYYY-MM-DD the API expects', () => {
        expect(toDateString(new Date('2026-03-15T10:00:00Z'))).toBe('2026-03-15');
    });

    it('utcNotLocal: it formats the UTC date, not the local one', () => {
        // toISOString() is UTC. At 23:30 in Bucharest (UTC+2) it is already the
        // NEXT day locally but still 21:30 UTC, so this returns the day before
        // the one the user sees on their phone. A task scheduled late in the
        // evening is filed against yesterday. Pinned deliberately: this is
        // current behaviour, and inverting this test is the sign someone fixed it.
        const lateEvening = new Date('2026-03-15T22:30:00Z'); // 00:30 on the 16th in Bucharest
        expect(lateEvening.getDate()).toBe(16);
        expect(toDateString(lateEvening)).toBe('2026-03-15');
    });
});

describe('formatDisplayDate', () => {
    it('renders weekday, day, month and year in Romanian', () => {
        const formatted = formatDisplayDate(new Date('2026-03-15T12:00:00Z'));
        expect(formatted).toContain('martie');
        expect(formatted).toContain('15');
        expect(formatted).toContain('2026');
    });

    it('omits the year when asked', () => {
        const formatted = formatDisplayDate(new Date('2026-03-15T12:00:00Z'), false);
        expect(formatted).toContain('martie');
        expect(formatted).not.toContain('2026');
    });
});

describe('formatDateString', () => {
    it('parses then formats', () => {
        expect(formatDateString('2026-03-15T12:00:00Z')).toContain('martie');
    });

    it('returns an empty string for null/undefined/empty input', () => {
        expect(formatDateString(null)).toBe('');
        expect(formatDateString(undefined)).toBe('');
        expect(formatDateString('')).toBe('');
    });

    it('returns "Invalid Date" for garbage rather than throwing', () => {
        // The try/catch cannot help here: toLocaleDateString on an invalid Date
        // returns the string "Invalid Date", it does not throw. Documenting the
        // real behaviour so nobody relies on the fallback-to-input path.
        expect(() => formatDateString('garbage')).not.toThrow();
        expect(formatDateString('garbage')).toBe('Invalid Date');
    });
});
