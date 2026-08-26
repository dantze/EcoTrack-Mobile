import { describe, it, expect } from 'vitest';
import { formatPrice, validateRequired, validatePositiveNumber, validatePositiveInt } from '../formatters';

describe('formatPrice', () => {
    it('groups thousands the Romanian way and appends RON', () => {
        // ro-RO groups with '.', so 1250 renders as "1.250 RON", not "1,250 RON".
        expect(formatPrice(1250)).toBe('1.250 RON');
        expect(formatPrice(0)).toBe('0 RON');
    });

    it('keeps at most two decimals and drops trailing zeros', () => {
        expect(formatPrice(99.5)).toBe('99,5 RON');
        expect(formatPrice(99.456)).toBe('99,46 RON');
        expect(formatPrice(100.0)).toBe('100 RON');
    });
});

describe('validateRequired', () => {
    it('returns null when there is a value', () => {
        expect(validateRequired('Ana', 'Numele')).toBeNull();
    });

    it('rejects whitespace-only input, naming the field in Romanian', () => {
        expect(validateRequired('', 'Numele')).toBe('Numele este obligatoriu.');
        expect(validateRequired('   ', 'Numele')).toBe('Numele este obligatoriu.');
    });
});

describe('validatePositiveNumber', () => {
    it('accepts zero and positives, including decimals', () => {
        expect(validatePositiveNumber('0', 'Prețul')).toBeNull();
        expect(validatePositiveNumber('12.5', 'Prețul')).toBeNull();
    });

    it('rejects negatives, blanks and non-numbers', () => {
        const message = 'Prețul trebuie să fie un număr valid pozitiv.';
        expect(validatePositiveNumber('-1', 'Prețul')).toBe(message);
        expect(validatePositiveNumber('', 'Prețul')).toBe(message);
        expect(validatePositiveNumber('abc', 'Prețul')).toBe(message);
    });

    it('accepts a trailing-garbage number, because parseFloat does', () => {
        // Documenting real behaviour: parseFloat('12abc') is 12. Worth knowing
        // before someone "fixes" a bug report about it.
        expect(validatePositiveNumber('12abc', 'Prețul')).toBeNull();
    });

    it('rejects a comma decimal — the Romanian keyboard separator', () => {
        // parseFloat('12,5') is 12, so this passes today. If that ever becomes a
        // real complaint, the fix is normalising ',' to '.' before parsing.
        expect(validatePositiveNumber('12,5', 'Prețul')).toBeNull();
    });
});

describe('validatePositiveInt', () => {
    it('accepts integers from 1 up', () => {
        expect(validatePositiveInt('1', 'Cantitatea')).toBeNull();
        expect(validatePositiveInt('250', 'Cantitatea')).toBeNull();
    });

    it('rejects 0, negatives, blanks and non-numbers', () => {
        const message = 'Cantitatea trebuie să fie un număr întreg valid (min. 1).';
        expect(validatePositiveInt('0', 'Cantitatea')).toBe(message);
        expect(validatePositiveInt('-3', 'Cantitatea')).toBe(message);
        expect(validatePositiveInt('', 'Cantitatea')).toBe(message);
        expect(validatePositiveInt('abc', 'Cantitatea')).toBe(message);
    });

    it('truncates a decimal instead of rejecting it, because parseInt does', () => {
        expect(validatePositiveInt('2.9', 'Cantitatea')).toBeNull();
        // …but a decimal below 1 still fails, which is the case that matters.
        expect(validatePositiveInt('0.9', 'Cantitatea')).toBe(
            'Cantitatea trebuie să fie un număr întreg valid (min. 1).',
        );
    });
});
