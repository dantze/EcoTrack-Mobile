/**
 * The calendar's date arithmetic, which is where a month view actually breaks:
 * a grid that starts on the wrong weekday, a month that loses its 31st, or an
 * order that lands a day early because an ISO string got parsed as UTC.
 *
 * Weeks start MONDAY, matching `weekStartIso` and `Route.dayOfWeek`
 * (1 = Monday, per java.time.DayOfWeek) — see the note at the top of
 * `../calendar`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AmplasareOrder, Client, IgienizareOrder, Order, RidicareOrder } from '@/types/domain';
import {
  buildMonthGrid,
  dayLabel,
  groupOrdersByDay,
  monthLabel,
  monthStartIso,
  monthTotal,
  shiftMonth,
} from '../calendar';

const CLIENT: Client = {
  id: 1,
  type: 'individual',
  fullName: 'Ana Pop',
  email: null,
  phone: null,
  address: null,
  CNP: null,
};

function amplasare(id: number, startDate: string | null, endDate: string | null = null): Order {
  return {
    id,
    number: id,
    date: `${startDate ?? '2026-01-01'}T08:00:00Z`,
    client: CLIENT,
    contact: null,
    details: null,
    orderType: 'Amplasari',
    product: null,
    quantity: 1,
    isIndefinite: false,
    durationDays: null,
    startDate,
    endDate,
    locationCoordinates: null,
    locationAddress: null,
    igienizariPerMonth: 1,
  } satisfies AmplasareOrder;
}

function ridicare(id: number, pickupDate: string | null): Order {
  return {
    id,
    number: id,
    date: '2026-08-01T08:00:00Z',
    client: CLIENT,
    contact: null,
    details: null,
    orderType: 'Ridicari',
    product: null,
    pickupDate,
    pickupQuantity: 1,
    pickupProductName: null,
    pickupLocationAddress: null,
    pickupLocationCoordinates: null,
  } satisfies RidicareOrder;
}

function igienizare(id: number, sanitationDate: string | null): Order {
  return {
    id,
    number: id,
    date: '2026-08-01T08:00:00Z',
    client: CLIENT,
    contact: null,
    details: null,
    orderType: 'Igienizari',
    subscription: null,
    sanitationDate,
    sanitationLocationAddress: null,
    sanitationLocationCoordinates: null,
    recurringPlan: null,
  } satisfies IgienizareOrder;
}

describe('month arithmetic', () => {
  afterEach(() => vi.useRealTimers());

  it('pins a month to its first day', () => {
    expect(monthStartIso(new Date(2026, 7, 14))).toBe('2026-08-01');
  });

  it('steps forward and back across a year boundary', () => {
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01');
  });

  it('steps from a 31-day month into a 28-day one without overflowing', () => {
    // The classic bug: adding a month to "31 January" lands on "3 March".
    // Pinning to day 1 is what prevents it.
    expect(shiftMonth('2026-01-01', 1)).toBe('2026-02-01');
    expect(shiftMonth('2026-03-01', -1)).toBe('2026-02-01');
  });

  it('labels a month in Romanian, capitalised for a heading', () => {
    expect(monthLabel('2026-08-01')).toBe('August 2026');
  });

  it('labels a day with its weekday, for the day panel title', () => {
    expect(dayLabel('2026-08-14')).toBe('Vineri, 14 august 2026');
  });
});

describe('buildMonthGrid', () => {
  it('starts the grid on the Monday of the week containing the 1st', () => {
    // 1 August 2026 is a Saturday, so the grid opens on Monday 27 July.
    const cells = buildMonthGrid('2026-08-01', '2026-08-14');

    expect(cells[0].iso).toBe('2026-07-27');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[6].iso).toBe('2026-08-02');
  });

  it('opens on the 1st itself when the month already starts on a Monday', () => {
    // 1 June 2026 is a Monday — no leading days at all.
    const cells = buildMonthGrid('2026-06-01', '2026-06-15');

    expect(cells[0].iso).toBe('2026-06-01');
    expect(cells[0].inMonth).toBe(true);
  });

  it('covers every day of the month exactly once', () => {
    const cells = buildMonthGrid('2026-08-01', '2026-08-14');
    const inMonth = cells.filter((cell) => cell.inMonth).map((cell) => cell.iso);

    expect(inMonth).toHaveLength(31);
    expect(inMonth[0]).toBe('2026-08-01');
    expect(inMonth[30]).toBe('2026-08-31');
    expect(new Set(inMonth).size).toBe(31);
  });

  it('always returns whole weeks and never a blank trailing one', () => {
    for (const month of ['2026-02-01', '2026-06-01', '2026-08-01', '2027-02-01']) {
      const cells = buildMonthGrid(month, '2026-08-14');
      expect(cells.length % 7).toBe(0);
      // A seventh row would mean the padding overshot by a whole week.
      expect(cells.length).toBeLessThanOrEqual(42);
      expect(cells.slice(-7).some((cell) => cell.inMonth)).toBe(true);
    }
  });

  it('crosses the October DST night without dropping or repeating a day', () => {
    // Romania's clocks go back on 25 October 2026. Millisecond arithmetic would
    // make that a 25-hour day and shift everything after it by an hour.
    const october = buildMonthGrid('2026-10-01', '2026-10-01')
      .filter((cell) => cell.inMonth)
      .map((cell) => cell.iso);

    expect(october).toHaveLength(31);
    expect(october).toContain('2026-10-25');
    expect(october).toContain('2026-10-26');
  });

  it('flags today and the weekend', () => {
    const cells = buildMonthGrid('2026-08-01', '2026-08-14');
    const today = cells.find((cell) => cell.iso === '2026-08-14');
    const saturday = cells.find((cell) => cell.iso === '2026-08-15');
    const monday = cells.find((cell) => cell.iso === '2026-08-17');

    expect(today?.isToday).toBe(true);
    expect(saturday?.isWeekend).toBe(true);
    expect(monday?.isWeekend).toBe(false);
    expect(cells.filter((cell) => cell.isToday)).toHaveLength(1);
  });

  it('defaults `today` to the real clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00'));
    try {
      const cells = buildMonthGrid('2026-08-01');
      expect(cells.find((cell) => cell.isToday)?.iso).toBe('2026-08-14');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('groupOrdersByDay', () => {
  it('buckets each order type on its own primary date', () => {
    const buckets = groupOrdersByDay([
      amplasare(1, '2026-08-10', '2026-09-30'),
      ridicare(2, '2026-08-10'),
      igienizare(3, '2026-08-12'),
    ]);

    expect(buckets.get('2026-08-10')?.total).toBe(2);
    expect(buckets.get('2026-08-10')?.counts).toEqual({
      Amplasari: 1,
      Ridicari: 1,
      Igienizari: 0,
    });
    expect(buckets.get('2026-08-12')?.counts.Igienizari).toBe(1);
  });

  it('puts a placement on the day it starts, not on every day of its window', () => {
    // The window is a contract; the placement is the work. Spreading it would
    // report a 60-day rental as 60 days of work.
    const buckets = groupOrdersByDay([amplasare(1, '2026-08-10', '2026-10-09')]);

    expect(buckets.get('2026-08-10')?.total).toBe(1);
    expect(buckets.has('2026-08-11')).toBe(false);
    expect(buckets.has('2026-10-09')).toBe(false);
  });

  it('drops orders with no primary date instead of inventing a day', () => {
    const buckets = groupOrdersByDay([amplasare(1, null), ridicare(2, null), igienizare(3, null)]);

    expect(buckets.size).toBe(0);
  });

  it('sorts a day by order number, so the panel is stable between renders', () => {
    const buckets = groupOrdersByDay([
      ridicare(9, '2026-08-10'),
      igienizare(3, '2026-08-10'),
      amplasare(7, '2026-08-10'),
    ]);

    expect(buckets.get('2026-08-10')?.orders.map((order) => order.number)).toEqual([3, 7, 9]);
  });
});

describe('monthTotal', () => {
  it('counts only the grid cells that belong to the month itself', () => {
    const cells = buildMonthGrid('2026-08-01', '2026-08-14');
    const buckets = groupOrdersByDay([
      amplasare(1, '2026-07-28'), // a leading cell, borrowed from July
      ridicare(2, '2026-08-03'),
      igienizare(3, '2026-08-31'),
      amplasare(4, '2026-09-01'), // a trailing cell, borrowed from September
    ]);

    expect(monthTotal(cells, buckets)).toBe(2);
  });
});
