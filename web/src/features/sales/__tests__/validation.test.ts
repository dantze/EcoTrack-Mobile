/**
 * Sales form validation.
 *
 * These rules were ported 1:1 from the mobile app, whose copies TODO-33
 * deleted. What is worth testing is no longer that two implementations agree —
 * there is one — but that this one still behaves the way the crew learned it
 * does. The behaviour is the contract now, and these cases are its statement.
 *
 * The Romanian message wording is asserted too — it is user-facing copy, and
 * the phone/decimal handling encodes local conventions (comma decimals,
 * 07XXXXXXXX legacy numbers) that are easy to "clean up" by accident.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHONE_CODE,
  isValidEmail,
  isValidPhoneDigits,
  joinPhone,
  normaliseDecimal,
  parseDecimal,
  splitPhone,
  validatePositiveInt,
  validatePositiveNumber,
  validateRequired,
} from '../validation';

describe('isValidEmail', () => {
  it.each(['ion@example.ro', 'office@acme.co.uk', 'a@b.cd'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'ion', 'ion@', '@example.ro', 'ion@example', 'ion example@ro.ro'])(
    'rejects %s',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );

  it('trims before testing, so a pasted address with spaces still passes', () => {
    expect(isValidEmail('  ion@example.ro  ')).toBe(true);
  });
});

describe('isValidPhoneDigits', () => {
  it('accepts 4 to 15 digits', () => {
    expect(isValidPhoneDigits('0730')).toBe(true);
    expect(isValidPhoneDigits('730712100')).toBe(true);
    expect(isValidPhoneDigits('123456789012345')).toBe(true);
  });

  it('rejects too short, too long, and anything non-digit', () => {
    expect(isValidPhoneDigits('073')).toBe(false);
    expect(isValidPhoneDigits('1234567890123456')).toBe(false);
    expect(isValidPhoneDigits('+40730712100')).toBe(false);
    expect(isValidPhoneDigits('0730 712 100')).toBe(false);
    expect(isValidPhoneDigits('')).toBe(false);
  });
});

describe('validateRequired', () => {
  it('returns null for a filled field', () => {
    expect(validateRequired('Ion', 'Numele')).toBeNull();
  });

  it('treats whitespace-only as empty and names the field in Romanian', () => {
    expect(validateRequired('   ', 'Numele')).toBe('Numele este obligatoriu.');
    expect(validateRequired('', 'CUI')).toBe('CUI este obligatoriu.');
  });
});

describe('decimals — Romanian keyboards type "12,5"', () => {
  it('normaliseDecimal swaps the comma for a dot', () => {
    expect(normaliseDecimal('12,5')).toBe('12.5');
    expect(normaliseDecimal(' 12,5 ')).toBe('12.5');
    expect(normaliseDecimal('12.5')).toBe('12.5');
  });

  it('parseDecimal parses both separators', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(Number.isNaN(parseDecimal('abc'))).toBe(true);
  });

  it('only the FIRST comma is replaced, so a thousands separator is not silently accepted', () => {
    // Documented consequence of the 1:1 port: "1,234,5" parses as 1.234.
    expect(normaliseDecimal('1,234,5')).toBe('1.234,5');
    expect(parseDecimal('1,234,5')).toBe(1.234);
  });
});

describe('validatePositiveNumber', () => {
  it('accepts zero and positive values, including comma decimals', () => {
    expect(validatePositiveNumber('0', 'Prețul')).toBeNull();
    expect(validatePositiveNumber('12,5', 'Prețul')).toBeNull();
    expect(validatePositiveNumber('500', 'Prețul')).toBeNull();
  });

  it('rejects blanks, negatives and non-numbers with the Romanian message', () => {
    const message = 'Prețul trebuie să fie un număr valid pozitiv.';
    expect(validatePositiveNumber('', 'Prețul')).toBe(message);
    expect(validatePositiveNumber('   ', 'Prețul')).toBe(message);
    expect(validatePositiveNumber('-1', 'Prețul')).toBe(message);
    expect(validatePositiveNumber('abc', 'Prețul')).toBe(message);
  });
});

describe('validatePositiveInt', () => {
  it('requires at least 1 — a zero-cabin order is not an order', () => {
    expect(validatePositiveInt('1', 'Cantitatea')).toBeNull();
    expect(validatePositiveInt('0', 'Cantitatea')).toBe(
      'Cantitatea trebuie să fie un număr întreg valid (min. 1).',
    );
    expect(validatePositiveInt('-3', 'Cantitatea')).toBeTruthy();
    expect(validatePositiveInt('', 'Cantitatea')).toBeTruthy();
  });

  it('parseInt truncates, so "2.9" is accepted as 2 rather than rejected', () => {
    // Current behaviour, pinned: the field is a number input in practice, but
    // a pasted decimal is silently floored instead of erroring.
    expect(validatePositiveInt('2.9', 'Cantitatea')).toBeNull();
  });
});

describe('splitPhone / joinPhone', () => {
  it('splits a stored number on its dialling code', () => {
    expect(splitPhone('+40730712100')).toEqual({ code: '+40', digits: '730712100' });
    expect(splitPhone('+33612345678')).toEqual({ code: '+33', digits: '612345678' });
  });

  it('prefers the LONGEST matching code, so +372 does not collapse into +37x', () => {
    // "+372…" also starts with no shorter listed code, but "+352"/"+351" style
    // three-digit codes must win over any two-digit prefix that could match.
    expect(splitPhone('+35112345678')).toEqual({ code: '+351', digits: '12345678' });
    expect(splitPhone('+37212345678')).toEqual({ code: '+372', digits: '12345678' });
  });

  it('upgrades the legacy Romanian local format 07XXXXXXXX to +40', () => {
    expect(splitPhone('0730712100')).toEqual({ code: '+40', digits: '730712100' });
  });

  it('strips formatting characters before matching', () => {
    expect(splitPhone('+40 730 712 100')).toEqual({ code: '+40', digits: '730712100' });
    expect(splitPhone('(0730) 712-100')).toEqual({ code: '+40', digits: '730712100' });
  });

  it('falls back to the default code for an empty or unrecognised value', () => {
    expect(splitPhone(null)).toEqual({ code: DEFAULT_PHONE_CODE, digits: '' });
    expect(splitPhone(undefined)).toEqual({ code: DEFAULT_PHONE_CODE, digits: '' });
    expect(splitPhone('')).toEqual({ code: DEFAULT_PHONE_CODE, digits: '' });
    expect(splitPhone('+99912345')).toEqual({ code: DEFAULT_PHONE_CODE, digits: '99912345' });
  });

  it('does not eat the leading zero of an international 00 prefix', () => {
    expect(splitPhone('0040730712100').digits).toBe('0040730712100');
  });

  it('joinPhone round-trips with splitPhone', () => {
    const original = '+40730712100';
    const { code, digits } = splitPhone(original);
    expect(joinPhone(code, digits)).toBe(original);
  });

  it('joinPhone trims stray whitespace from the digits', () => {
    expect(joinPhone('+40', ' 730712100 ')).toBe('+40730712100');
  });
});
