import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkDigit, cnpControlDigit, isValidCnp, parseMrz } from './mrz';

/**
 * The golden fixture (TODO-13), read from the same file the web suite reads.
 *
 * `utils/mrz.ts` is a copy of `web/src/features/sales/idScan/mrz.ts` — two
 * projects, no shared package, no way to import each other. `shared/id-mrz-cases.json`
 * is what pins that the copies still AGREE: a case added there fails whichever
 * side does not follow it, which is the only mechanism that will notice the day
 * someone fixes a parsing bug in one app and not the other.
 *
 * Same arrangement as the fulfilment rule (TODO-41).
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

// Vitest runs with `mobile/` as the working directory.
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

describe('the pieces the fixture leans on', () => {
  it('computes the ICAO check digit to the spec worked example', () => {
    expect(checkDigit('D23145890734')).toBe(9);
  });

  it('rejects every CNP control digit but the right one', () => {
    for (let digit = 0; digit <= 9; digit += 1) {
      expect(isValidCnp(`180010140123${digit}`)).toBe(digit === 7);
    }
  });

  it('accepts the two county codes outside the 01-46 run', () => {
    for (const county of ['51', '52']) {
      const body = `1800101${county}123`;
      expect(isValidCnp(body + cnpControlDigit(body))).toBe(true);
    }
  });
});
