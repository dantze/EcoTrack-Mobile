import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidPhoneDigits } from '../validation';

/**
 * These two rules also exist, ported, in `web/src/features/sales/validation.ts`.
 * If they drift, a client record created on a phone fails validation on the web
 * app and vice versa. The web side has its own suite; this is the mobile half.
 */

describe('isValidEmail', () => {
    it('accepts ordinary addresses', () => {
        expect(isValidEmail('ana@ecotrack.ro')).toBe(true);
        expect(isValidEmail('ana.popescu+comenzi@sub.example.co.uk')).toBe(true);
    });

    it('trims before testing, so a pasted address with spaces still passes', () => {
        expect(isValidEmail('  ana@ecotrack.ro  ')).toBe(true);
    });

    it('rejects the shapes that actually get typed', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('ana')).toBe(false);
        expect(isValidEmail('ana@')).toBe(false);
        expect(isValidEmail('@ecotrack.ro')).toBe(false);
        expect(isValidEmail('ana@ecotrack')).toBe(false);
        expect(isValidEmail('ana @ecotrack.ro')).toBe(false);
        expect(isValidEmail('ana@@ecotrack.ro')).toBe(false);
    });
});

describe('isValidPhoneDigits', () => {
    it('accepts 4 to 15 digits', () => {
        expect(isValidPhoneDigits('0712')).toBe(true);
        expect(isValidPhoneDigits('712345678')).toBe(true);
        expect(isValidPhoneDigits('123456789012345')).toBe(true);
    });

    it('rejects anything outside that length', () => {
        expect(isValidPhoneDigits('071')).toBe(false);
        expect(isValidPhoneDigits('1234567890123456')).toBe(false);
        expect(isValidPhoneDigits('')).toBe(false);
    });

    it('is digits only — this runs on the national part, after the country code', () => {
        expect(isValidPhoneDigits('+40712345678')).toBe(false);
        expect(isValidPhoneDigits('0712 345 678')).toBe(false);
        expect(isValidPhoneDigits('0712-345-678')).toBe(false);
    });

    it('trims surrounding whitespace first', () => {
        expect(isValidPhoneDigits('  712345678  ')).toBe(true);
    });
});
