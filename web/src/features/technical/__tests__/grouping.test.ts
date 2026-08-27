/**
 * Dispatch grouping heuristics.
 *
 * The dispatch board proposes work to a dispatcher, so the failure modes worth
 * testing are the ones that would erode trust in the proposal:
 *
 *   - proposing a job on the wrong day (the one filter that must never leak);
 *   - proposing a job that is nowhere near the route;
 *   - proposing a reorder that is not actually shorter, or that quietly moves
 *     the first stop, which the dispatcher relies on staying put;
 *   - nagging when there is nothing useful to say.
 *
 * Coordinates below are real Bucharest-area points so the kilometres in the
 * assertions are recognisable rather than abstract.
 */

import { describe, expect, it } from 'vitest';
import type { Employee, Route, Task } from '@/types/domain';
import {
  distanceKm,
  localityOf,
  orderByProximity,
  pathLengthKm,
  suggestRouteGroup,
  suggestStopOrder,
} from '../grouping';

const DRIVER: Employee = {
  id: 1,
  username: 'sofer',
  fullName: 'Ionuț Barbu',
  phone: null,
  county: 'Ilfov',
  roles: ['DRIVER'],
};

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

function route(overrides: Partial<Route> = {}): Route {
  return {
    id: 500,
    name: 'Ruta Ilfov Nord',
    dayOfWeek: 1,
    county: 'Ilfov',
    employee: DRIVER,
    tasks: [],
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

describe('localityOf', () => {
  it('takes the last comma-separated chunk, folded for comparison', () => {
    expect(localityOf('Str. Exemplu nr. 12, Otopeni')).toBe('otopeni');
    expect(localityOf('Bd. Mare 3, Sector 1, București')).toBe('bucurești');
  });

  it('handles a missing or trailing-comma address', () => {
    expect(localityOf(null)).toBeNull();
    expect(localityOf('Otopeni,')).toBe('otopeni');
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

describe('suggestRouteGroup', () => {
  const stops = [task({ coordinates: POINTS.otopeni, address: 'Str. A nr. 1, Otopeni' })];

  it('never proposes a job scheduled for another day', () => {
    const pool = [
      task({ coordinates: POINTS.voluntari, scheduledDate: '2026-05-09' }),
      task({ coordinates: POINTS.voluntari, scheduledDate: '2026-05-11' }),
    ];
    expect(suggestRouteGroup(route(), stops, pool)).toBeNull();
  });

  it('accepts unscheduled jobs — they have no day to conflict with', () => {
    const pool = [
      task({ coordinates: POINTS.voluntari, scheduledDate: null, scheduledTime: null }),
      task({ coordinates: POINTS.buftea, scheduledDate: null, scheduledTime: null }),
    ];
    expect(suggestRouteGroup(route(), stops, pool)!.candidates).toHaveLength(2);
  });

  it('drops jobs outside the radius and keeps the nearby ones', () => {
    const pool = [
      task({ coordinates: POINTS.voluntari }),
      task({ coordinates: POINTS.buftea }),
      task({ coordinates: POINTS.cluj }),
    ];
    const suggestion = suggestRouteGroup(route(), stops, pool)!;
    expect(suggestion.candidates).toHaveLength(2);
    expect(
      suggestion.candidates.some((candidate) => candidate.task.coordinates === POINTS.cluj),
    ).toBe(false);
  });

  it('stays quiet when only one job qualifies', () => {
    expect(suggestRouteGroup(route(), stops, [task({ coordinates: POINTS.voluntari })])).toBeNull();
  });

  it('proposes ids as existing stops followed by the new ones, in driving order', () => {
    const pool = [
      task({ coordinates: POINTS.popesti, clientName: 'departe' }),
      task({ coordinates: POINTS.voluntari, clientName: 'aproape' }),
    ];
    const suggestion = suggestRouteGroup(route(), stops, pool)!;
    expect(suggestion.orderedIds.slice(0, stops.length)).toEqual(stops.map((stop) => stop.id));
    expect(suggestion.candidates[0]!.task.clientName).toBe('aproape');
    expect(suggestion.addedKm).toBeGreaterThan(0);
  });

  it('explains each candidate in Romanian', () => {
    const pool = [task({ coordinates: POINTS.voluntari }), task({ coordinates: POINTS.buftea })];
    for (const candidate of suggestRouteGroup(route(), stops, pool)!.candidates) {
      expect(candidate.reason).toMatch(/km|localitate|județ/);
    }
  });

  it('seeds from the densest cluster when the route has no stops yet', () => {
    // Three jobs around Otopeni/Buftea and one in Cluj: the cluster wins and
    // Cluj is left out, even though there is no route geometry to compare to.
    const pool = [
      task({ coordinates: POINTS.otopeni }),
      task({ coordinates: POINTS.buftea }),
      task({ coordinates: POINTS.voluntari }),
      task({ coordinates: POINTS.cluj }),
    ];
    const suggestion = suggestRouteGroup(route(), [], pool)!;
    expect(suggestion.candidates).toHaveLength(3);
    expect(
      suggestion.candidates.some((candidate) => candidate.task.coordinates === POINTS.cluj),
    ).toBe(false);
  });

  it('falls back to locality names for jobs with no coordinates', () => {
    const pool = [
      task({ coordinates: null, address: 'Str. C nr. 3, Otopeni' }),
      task({ coordinates: null, address: 'Str. D nr. 4, Otopeni' }),
      task({ coordinates: null, address: 'Str. E nr. 5, Cluj-Napoca' }),
    ];
    const suggestion = suggestRouteGroup(route(), stops, pool)!;
    expect(suggestion.candidates).toHaveLength(2);
    expect(suggestion.candidates[0]!.reason).toMatch(/localitate/);
  });

  it('returns null for an empty pool', () => {
    expect(suggestRouteGroup(route(), stops, [])).toBeNull();
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
