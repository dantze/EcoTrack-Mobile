/**
 * The one definition of "current vs fulfilled" the web app has. Comenzi's
 * Arhivă and the map's `done` lifecycle both read it, so a change here moves
 * two screens at once — which is the whole point of the module existing.
 *
 * The suite is organised around the two evidence sources and their precedence:
 * task status wins where it is conclusive, dates decide the rest, and the
 * summary-vs-full-task-list entry points must never disagree.
 */

import { describe, expect, it } from 'vitest';
import type {
  AmplasareOrder,
  IgienizareOrder,
  Individual,
  RidicareOrder,
  Task,
  TaskStatus,
} from '@/types/domain';
import {
  deriveLifecycle,
  deriveLifecycleFromTasks,
  isFulfilled,
  orderPrimaryDate,
  summarizeTaskStatus,
} from '../orderLifecycle';

const TODAY = '2026-06-15';
const PAST = '2026-05-01';
const FUTURE = '2026-07-01';

let seq = 0;
const nextId = () => (seq += 1);

const CLIENT: Individual = {
  id: 1,
  email: null,
  phone: null,
  address: null,
  type: 'individual',
  fullName: 'Client Test',
  CNP: null,
  idPhotoUrl: null,
};

function amplasare(overrides: Partial<AmplasareOrder> = {}): AmplasareOrder {
  const id = nextId();
  return {
    id,
    number: id,
    date: `${TODAY}T08:00:00`,
    client: CLIENT,
    contact: null,
    details: null,
    orderType: 'Amplasari',
    product: null,
    quantity: 2,
    isIndefinite: false,
    durationDays: 30,
    startDate: PAST,
    endDate: FUTURE,
    locationCoordinates: null,
    locationAddress: null,
    igienizariPerMonth: 1,
    ...overrides,
  };
}

function ridicare(overrides: Partial<RidicareOrder> = {}): RidicareOrder {
  const id = nextId();
  return {
    id,
    number: id,
    date: `${TODAY}T08:00:00`,
    client: CLIENT,
    contact: null,
    details: null,
    orderType: 'Ridicari',
    product: null,
    pickupDate: TODAY,
    pickupQuantity: 2,
    pickupProductName: null,
    pickupLocationAddress: null,
    pickupLocationCoordinates: null,
    ...overrides,
  };
}

function igienizare(overrides: Partial<IgienizareOrder> = {}): IgienizareOrder {
  const id = nextId();
  return {
    id,
    number: id,
    date: `${TODAY}T08:00:00`,
    client: CLIENT,
    contact: null,
    details: null,
    orderType: 'Igienizari',
    subscription: null,
    sanitationDate: TODAY,
    sanitationLocationAddress: null,
    sanitationLocationCoordinates: null,
    recurringPlan: null,
    ...overrides,
  };
}

function task(status: TaskStatus): Task {
  const id = nextId();
  return {
    id,
    type: 'PLACEMENT',
    scheduledTime: null,
    scheduledDate: TODAY,
    status,
    address: null,
    coordinates: null,
    clientName: null,
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
  };
}

// ---------------------------------------------------------------------------
// summarizeTaskStatus
// ---------------------------------------------------------------------------

describe('summarizeTaskStatus', () => {
  it('is null with no tasks — "no evidence", not "nothing done"', () => {
    expect(summarizeTaskStatus([])).toBeNull();
  });

  it('is COMPLETED only when every task is', () => {
    expect(summarizeTaskStatus([task('COMPLETED'), task('COMPLETED')])).toBe('COMPLETED');
    expect(summarizeTaskStatus([task('COMPLETED'), task('NEW')])).toBe('NEW');
  });

  it('lets a single IN_PROGRESS outrank the NEWs around it', () => {
    expect(summarizeTaskStatus([task('NEW'), task('IN_PROGRESS'), task('COMPLETED')])).toBe(
      'IN_PROGRESS',
    );
  });
});

// ---------------------------------------------------------------------------
// The archive rule — the three cases TODO-21 names
// ---------------------------------------------------------------------------

describe('isFulfilled — task evidence', () => {
  it('archives an order whose tasks are ALL completed', () => {
    const order = amplasare({ endDate: FUTURE });
    const tasks = [task('COMPLETED'), task('COMPLETED')];
    expect(deriveLifecycleFromTasks(order, tasks, TODAY)).toBe('done');
    expect(isFulfilled(order, summarizeTaskStatus(tasks), TODAY)).toBe(true);
  });

  it('does NOT archive a mixed order, even one task short', () => {
    const order = amplasare({ endDate: FUTURE });
    const tasks = [task('COMPLETED'), task('COMPLETED'), task('NEW')];
    expect(isFulfilled(order, summarizeTaskStatus(tasks), TODAY)).toBe(false);
  });

  it('does not archive an order still in progress', () => {
    const order = ridicare({ pickupDate: PAST });
    expect(isFulfilled(order, 'IN_PROGRESS', TODAY)).toBe(false);
  });

  it('keeps an open task out of the archive even when the dates say "past"', () => {
    // Dates alone would call this done; the open task overrules them. This is
    // the precedence that makes the archive safe to hide from Comenzi.
    const order = amplasare({ startDate: PAST, endDate: PAST });
    expect(deriveLifecycle(order, 'NEW', TODAY)).toBe('overdue');
    expect(isFulfilled(order, 'NEW', TODAY)).toBe(false);
  });
});

describe('isFulfilled — date fallback when an order has no tasks', () => {
  it('archives an Amplasare whose window has closed', () => {
    expect(isFulfilled(amplasare({ startDate: PAST, endDate: PAST }), null, TODAY)).toBe(true);
  });

  it('keeps an Amplasare inside its window', () => {
    expect(isFulfilled(amplasare({ startDate: PAST, endDate: FUTURE }), null, TODAY)).toBe(false);
  });

  it('never archives an indefinite Amplasare, whatever endDate says', () => {
    const order = amplasare({ startDate: PAST, endDate: PAST, isIndefinite: true });
    expect(deriveLifecycle(order, null, TODAY)).toBe('active');
    expect(isFulfilled(order, null, TODAY)).toBe(false);
  });

  it('archives a Ridicare dated strictly before today', () => {
    expect(isFulfilled(ridicare({ pickupDate: PAST }), null, TODAY)).toBe(true);
    expect(isFulfilled(ridicare({ pickupDate: TODAY }), null, TODAY)).toBe(false);
    expect(isFulfilled(ridicare({ pickupDate: FUTURE }), null, TODAY)).toBe(false);
  });

  it('archives an Igienizare dated strictly before today', () => {
    expect(isFulfilled(igienizare({ sanitationDate: PAST }), null, TODAY)).toBe(true);
    expect(isFulfilled(igienizare({ sanitationDate: TODAY }), null, TODAY)).toBe(false);
  });

  it('leaves a dateless order in Comenzi rather than guessing', () => {
    expect(deriveLifecycle(amplasare({ startDate: null }), null, TODAY)).toBe('unknown');
    expect(isFulfilled(amplasare({ startDate: null }), null, TODAY)).toBe(false);
    expect(isFulfilled(ridicare({ pickupDate: null }), null, TODAY)).toBe(false);
  });

  it('falls through to the dates when tasks are NEW but the anchor has not passed', () => {
    // All-NEW is only a signal once the anchor is behind us; before that it
    // says nothing the schedule does not already say.
    const order = ridicare({ pickupDate: FUTURE });
    expect(deriveLifecycle(order, 'NEW', TODAY)).toBe('upcoming');
    expect(deriveLifecycle(order, null, TODAY)).toBe('upcoming');
  });
});

// ---------------------------------------------------------------------------
// The two entry points must not drift
// ---------------------------------------------------------------------------

describe('deriveLifecycleFromTasks agrees with the summary form', () => {
  const cases: Task[][] = [
    [],
    [task('NEW')],
    [task('COMPLETED')],
    [task('NEW'), task('COMPLETED')],
    [task('IN_PROGRESS'), task('COMPLETED')],
  ];

  it('gives the same verdict for every task combination', () => {
    for (const order of [amplasare({ startDate: PAST, endDate: PAST }), ridicare(), igienizare()]) {
      for (const tasks of cases) {
        expect(deriveLifecycleFromTasks(order, tasks, TODAY)).toBe(
          deriveLifecycle(order, summarizeTaskStatus(tasks), TODAY),
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Anchor date
// ---------------------------------------------------------------------------

describe('orderPrimaryDate', () => {
  it('reads the field each order subtype is actually anchored to', () => {
    expect(orderPrimaryDate(amplasare({ startDate: PAST }))).toBe(PAST);
    expect(orderPrimaryDate(ridicare({ pickupDate: FUTURE }))).toBe(FUTURE);
    expect(orderPrimaryDate(igienizare({ sanitationDate: TODAY }))).toBe(TODAY);
  });
});
