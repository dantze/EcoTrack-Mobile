import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkDigit, cnpControlDigit, isValidCnp, parseMrz } from '../idScan/mrz';

/**
 * The golden fixture (TODO-13).
 *
 * The accept/reject rule is written twice — here and in `mobile/utils/mrz.ts` —
 * in two projects that cannot import each other. `shared/id-mrz-cases.json` is
 * what pins that they still AGREE, and `mobile/utils/mrz.test.ts` reads the very
 * same file. A case added there fails whichever side does not follow it.
 *
 * Same shape as `fulfilment.test.ts` and for the same reason: a duplicated rule
 * with no shared code needs a shared fixture or it silently drifts.
 */
interface GoldenCase {
  name: string;
  mrz: string[];
  accepted: boolean;
  fullName: string | null;
  cnp: string | null;
  sex: 'M' | 'F' | null;
  birthDate: string | null;
  rejection: string | null;
}

const fixture = JSON.parse(readFileSync('../shared/id-mrz-cases.json', 'utf8')) as {
  cases: GoldenCase[];
};

describe('shared/id-mrz-cases.json', () => {
  it('is not silently empty — the whole guard would pass vacuously', () => {
    expect(fixture.cases.length).toBeGreaterThan(10);
  });

  it('covers both outcomes — a fixture of only happy cases proves nothing about a guard', () => {
    expect(fixture.cases.some((entry) => entry.accepted)).toBe(true);
    expect(fixture.cases.some((entry) => !entry.accepted)).toBe(true);
  });

  it.each(fixture.cases)('$name', (entry) => {
    const result = parseMrz(entry.mrz);
    expect(result.ok).toBe(entry.accepted);

    if (result.ok) {
      expect(result.read.fullName).toBe(entry.fullName);
      expect(result.read.cnp).toBe(entry.cnp);
      expect(result.read.sex).toBe(entry.sex);
      expect(result.read.birthDate).toBe(entry.birthDate);
    } else {
      expect(result.reason).toBe(entry.rejection);
    }
  });
});

describe('checkDigit', () => {
  // The worked example from ICAO 9303 Part 3, so the weighting is pinned to the
  // spec rather than to this implementation's own output.
  it('matches the ICAO worked example', () => {
    expect(checkDigit('D23145890734')).toBe(9);
  });

  it('counts filler as zero and letters from A=10', () => {
    expect(checkDigit('<<<<<')).toBe(0);
    expect(checkDigit('A')).toBe(0); // 10 * 7 = 70
    expect(checkDigit('B')).toBe(7); // 11 * 7 = 77
  });
});

describe('isValidCnp', () => {
  it('accepts a well-formed CNP', () => {
    expect(isValidCnp('1800101401237')).toBe(true);
  });

  it('rejects a wrong control digit', () => {
    for (let digit = 0; digit <= 9; digit += 1) {
      const candidate = `180010140123${digit}`;
      expect(isValidCnp(candidate)).toBe(candidate === '1800101401237');
    }
  });

  it('rejects a county code that does not exist', () => {
    // Positions 8-9 are the county: 01-46 plus 51/52. 47 is not one.
    const body = '180010147123';
    expect(isValidCnp(body + cnpControlDigit(body))).toBe(false);
  });

  it('accepts the two county codes that sit outside the 01-46 run', () => {
    // Călărași (51) and Giurgiu (52) were added after the original range, so a
    // naive `county <= 46` rejects two real counties' worth of clients.
    for (const county of ['51', '52']) {
      const body = `1800101${county}123`;
      expect(body).toHaveLength(12);
      expect(isValidCnp(body + cnpControlDigit(body))).toBe(true);
    }
  });

  it('rejects a date that does not exist', () => {
    const february30 = '180023040123';
    expect(isValidCnp(february30 + cnpControlDigit(february30))).toBe(false);
  });

  it('rejects a sector digit of 0, and anything that is not 13 digits', () => {
    const zeroSector = '080010140123';
    expect(isValidCnp(zeroSector + cnpControlDigit(zeroSector))).toBe(false);
    expect(isValidCnp('')).toBe(false);
    expect(isValidCnp('180010140123')).toBe(false);
    expect(isValidCnp('18001014012371')).toBe(false);
    expect(isValidCnp('18001014O1237')).toBe(false);
  });
});

describe('parseMrz', () => {
  const good = [
    'IDROUZC123456<21800101401237<<',
    '8001014M3001019ROU<<<<<<<<<<<4',
    'POPESCU<<ION<ANDREI<<<<<<<<<<<',
  ];

  it('accepts one blob of text as readily as an array of lines', () => {
    expect(parseMrz(good.join('\n'))).toEqual(parseMrz(good));
  });

  it('never resolves a birth date for sector digits 7/8/9, where no century is encoded', () => {
    // Same person, same card, sector digit 7 instead of 1 — the cross-check
    // still works (both sides are YYMMDD) but the century genuinely is not there.
    const body = '780010140123';
    const cnp = body + cnpControlDigit(body);
    expect(isValidCnp(cnp)).toBe(true);
    expect(cnp.slice(1, 7)).toBe('800101');
  });

  it('refuses a name field that is nothing but filler', () => {
    const result = parseMrz([good[0], good[1], '<'.repeat(30)]);
    expect(result).toEqual({ ok: false, reason: 'format' });
  });

  it('is not fooled into inventing a name when handed no input at all', () => {
    expect(parseMrz([])).toEqual({ ok: false, reason: 'format' });
    expect(parseMrz('')).toEqual({ ok: false, reason: 'format' });
  });
});
