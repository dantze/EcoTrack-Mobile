/**
 * Dispatch stop-order heuristics.
 *
 * The dispatch board proposes a driving order to a dispatcher, so the failure
 * modes worth testing are the ones that would erode trust in the proposal:
 *
 *   - proposing a reorder that is not actually shorter, or that quietly moves
 *     the first stop, which the dispatcher relies on staying put;
 *   - nagging when there is nothing useful to say.
 *
 * The route-grouping tests went with `suggestRouteGroup` (TODO-16).
 *
 * Coordinates below are real Bucharest-area points so the kilometres in the
 * assertions are recognisable rather than abstract.
 */

import { describe, expect, it } from 'vitest';
import type { Task } from '@/types/domain';
import { distanceKm, orderByProximity, pathLengthKm, suggestStopOrder } from '../grouping';

const TODAY = '2026-05-04';

/** Roughly: Otopeni, Voluntari, Popești-Leordeni, Buftea, and far-away Cluj. */
const POINTS = {
  otopeni: '44.5510,26.0714',
  voluntari: '44.4900,26.1800',
  popesti: '44.3830,26.1670',
  buftea: '44.5606,25.9481',
  cluj: '46.7712,23.6236',
} as const;

let nextId = 0;

function task(overrides: Partial<Task> = {}): Task {
  nextId += 1;
  return {
    id: nextId,
    type: 'PLACEMENT',
    scheduledTime: null,
    scheduledDate: TODAY,
    status: 'NEW',
    address: 'Str. Exemplu nr. 1, Otopeni',
    coordinates: POINTS.otopeni,
    clientName: `Client ${nextId}`,
    clientPhone: null,
    contactPerson: null,
    productName: null,
    quantity: null,
    internalNotes: null,
    orderIndex: 0,
    route: null,
    order: null,
    photos: [],
    recurringPlan: null,
    ...overrides,
  };
}

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

describe('orderByProximity', () => {
  it('walks nearest-neighbour from the seed point', () => {
    const near = task({ coordinates: POINTS.voluntari, clientName: 'aproape' });
    const far = task({ coordinates: POINTS.cluj, clientName: 'departe' });
    const ordered = orderByProximity([far, near], { lat: 44.551, lng: 26.0714 });
    expect(ordered.map((item) => item.clientName)).toEqual(['aproape', 'departe']);
  });

  it('pushes stops without coordinates to the end', () => {
    const blind = task({ coordinates: null, clientName: 'fără punct' });
    const known = task({ coordinates: POINTS.voluntari, clientName: 'cu punct' });
    const ordered = orderByProximity([blind, known], { lat: 44.551, lng: 26.0714 });
    expect(ordered.map((item) => item.clientName)).toEqual(['cu punct', 'fără punct']);
  });
});

describe('pathLengthKm', () => {
  it('sums the legs and ignores stops with no coordinates', () => {
    const withBlind = pathLengthKm([
      task({ coordinates: POINTS.otopeni }),
      task({ coordinates: null }),
      task({ coordinates: POINTS.voluntari }),
    ]);
    const withoutBlind = pathLengthKm([
      task({ coordinates: POINTS.otopeni }),
      task({ coordinates: POINTS.voluntari }),
    ]);
    expect(withBlind).toBeCloseTo(withoutBlind, 6);
  });
});

describe('suggestStopOrder', () => {
  it('says nothing about a route too short to reorder', () => {
    expect(suggestStopOrder([task(), task()])).toBeNull();
  });

  it('says nothing when the route is already efficient', () => {
    const ordered = [
      task({ coordinates: POINTS.buftea }),
      task({ coordinates: POINTS.otopeni }),
      task({ coordinates: POINTS.voluntari }),
    ];
    expect(suggestStopOrder(ordered)).toBeNull();
  });

  it('proposes a genuinely shorter path and keeps the first stop', () => {
    // Otopeni → Cluj → Voluntari → Buftea is a pointless round trip.
    const zigzag = [
      task({ coordinates: POINTS.otopeni }),
      task({ coordinates: POINTS.cluj }),
      task({ coordinates: POINTS.voluntari }),
      task({ coordinates: POINTS.buftea }),
    ];
    const suggestion = suggestStopOrder(zigzag)!;
    expect(suggestion.orderedIds[0]).toBe(zigzag[0]!.id);
    expect(suggestion.proposedKm).toBeLessThan(suggestion.currentKm);
    expect(suggestion.savedKm).toBeGreaterThan(2);
    expect(suggestion.orderedIds).toHaveLength(zigzag.length);
    expect([...suggestion.orderedIds].sort()).toEqual([...zigzag.map((t) => t.id)].sort());
    expect(suggestion.summary).toMatch(/km/);
  });

  it('needs real geometry — a route of blind stops is left alone', () => {
    expect(suggestStopOrder([task({ coordinates: null }), task({ coordinates: null }), task({ coordinates: null })])).toBeNull();
  });
});
