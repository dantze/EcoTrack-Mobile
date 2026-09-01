/**
 * Straight-line distance geometry (`../grouping.ts`).
 *
 * `TODO-16` removed the dispatch board's "recommended additions" suggestion
 * UI and the heuristics built only to feed it (`suggestRouteGroup`,
 * `suggestStopOrder`, and their helpers). `distanceKm` survives because
 * `@/features/map/data.ts` still uses it to estimate a route's straight-line
 * length, so it keeps its coverage here.
 */

import { describe, expect, it } from 'vitest';
import { distanceKm } from '../grouping';

describe('distanceKm', () => {
  it('is zero for the same point and symmetric', () => {
    const a = { lat: 44.55, lng: 26.07 };
    const b = { lat: 44.49, lng: 26.18 };
    expect(distanceKm(a, a)).toBe(0);
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
  });

  it('gets a known Ilfov hop about right', () => {
    // Otopeni → Voluntari is ~11 km as the crow flies.
    expect(distanceKm({ lat: 44.551, lng: 26.0714 }, { lat: 44.49, lng: 26.18 })).toBeGreaterThan(8);
    expect(distanceKm({ lat: 44.551, lng: 26.0714 }, { lat: 44.49, lng: 26.18 })).toBeLessThan(14);
  });
});
