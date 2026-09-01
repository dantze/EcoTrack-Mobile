/**
 * `buildMapData` is where the map's "incoming vs done" story is decided, so
 * the bulk of this suite is lifecycle derivation — every branch, and the
 * precedence between task evidence and dates that makes `overdue` mean
 * something. The rest covers the two other places wrong output would be
 * silently wrong: coordinate parsing (dropped orders) and site grouping
 * (stats a dispatcher will act on).
 *
 * Coordinates are real Bucharest-area points so kilometre assertions are
 * checkable against an independently computed haversine value, not just
 * "some positive number".
 */

import { describe, expect, it } from 'vitest';
import type {
  AmplasareOrder,
  Individual,
  IgienizareOrder,
  Order,
  Product,
  RidicareOrder,
  Route,
  Subscription,
  Task,
} from '@/types/domain';
import { EMPTY_FILTERS, type MapFilters } from '../types';
import { buildMapData } from '../data';

const TODAY = '2026-06-15';
const PAST = '2026-05-01';
const FUTURE = '2026-07-01';

/** Bucharest centre, Otopeni, Popești-Leordeni — real points, real distances. */
const POINTS = {
  bucuresti: '44.4268,26.1025',
  otopeni: '44.5510,26.0714',
  popesti: '44.3830,26.1670',
} as const;

// Independently verified: haversine(bucuresti, otopeni) ≈ 14.029 km.
const BUCURESTI_OTOPENI_KM = 14.029024450780009;

let seq = 0;
function nextId(): number {
  seq += 1;
  return seq;
}

const PRODUCT: Product = { id: 1, name: 'Toaletă standard', description: null, price: 100 };
const SUBSCRIPTION: Subscription = {
  id: 1,
  name: 'Igienizare lunară',
  description: null,
  type: 'RECURRING',
  price: 150,
  visitsPerMonth: 1,
  durationMonths: null,
  isIndefinite: true,
  isActive: true,
};

function client(overrides: Partial<Individual> = {}): Individual {
  const id = nextId();
  return {
    id,
    email: null,
    phone: null,
    address: null,
    type: 'individual',
    fullName: `Client ${id}`,
    CNP: null,
    ...overrides,
  };
}

function amplasare(overrides: Partial<AmplasareOrder> = {}): AmplasareOrder {
  const id = nextId();
  return {
    id,
    number: id,
    date: `${TODAY}T08:00:00`,
    client: client(),
    contact: null,
    details: null,
    orderType: 'Amplasari',
    product: PRODUCT,
    quantity: 2,
    isIndefinite: false,
    durationDays: 30,
    startDate: TODAY,
    endDate: FUTURE,
    locationCoordinates: POINTS.bucuresti,
    locationAddress: 'Str. Exemplu nr. 1, București',
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
    client: client(),
    contact: null,
    details: null,
    orderType: 'Ridicari',
    product: PRODUCT,
    pickupDate: TODAY,
    pickupQuantity: 2,
    pickupProductName: 'Toaletă standard',
    pickupLocationAddress: 'Str. Exemplu nr. 1, București',
    pickupLocationCoordinates: POINTS.bucuresti,
    ...overrides,
  };
}

function igienizare(overrides: Partial<IgienizareOrder> = {}): IgienizareOrder {
  const id = nextId();
  return {
    id,
    number: id,
    date: `${TODAY}T08:00:00`,
    client: client(),
    contact: null,
    details: null,
    orderType: 'Igienizari',
    subscription: SUBSCRIPTION,
    sanitationDate: TODAY,
    sanitationLocationAddress: 'Str. Exemplu nr. 1, București',
    sanitationLocationCoordinates: POINTS.bucuresti,
    recurringPlan: null,
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  const id = nextId();
  return {
    id,
    type: 'PLACEMENT',
    scheduledTime: null,
    scheduledDate: TODAY,
    status: 'NEW',
    address: 'Str. Exemplu nr. 1, București',
    coordinates: POINTS.bucuresti,
    clientName: 'Client Test',
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
  const id = nextId();
  return {
    id,
    name: `Ruta ${id}`,
    dayOfWeek: 1,
    county: 'Ilfov',
    employee: null,
    tasks: [],
    ...overrides,
  };
}

function build(
  orders: Order[],
  tasks: Task[] = [],
  routes: Route[] = [],
  filters: MapFilters = EMPTY_FILTERS,
) {
  return buildMapData({ orders, tasks, routes, filters, today: TODAY });
}

/** Links `t` to `order` both ways, the way the API's `Task.order` does. */
function forOrder(t: Task, order: Order): Task {
  return { ...t, order };
}

// ---------------------------------------------------------------------------
// Lifecycle — date-only (no tasks loaded for the order)
// ---------------------------------------------------------------------------

describe('lifecycle — Amplasari, date-only', () => {
  it('is upcoming before startDate', () => {
    const order = amplasare({ startDate: FUTURE, endDate: null });
    expect(build([order]).points[0]?.lifecycle).toBe('upcoming');
  });

  it('is active between startDate and endDate', () => {
    const order = amplasare({ startDate: PAST, endDate: FUTURE });
    expect(build([order]).points[0]?.lifecycle).toBe('active');
  });

  it('is active when indefinite with no endDate, even past startDate', () => {
    const order = amplasare({ startDate: PAST, endDate: null, isIndefinite: true });
    expect(build([order]).points[0]?.lifecycle).toBe('active');
  });

  it('is done once past endDate', () => {
    const order = amplasare({ startDate: PAST, endDate: PAST, isIndefinite: false });
    expect(build([order]).points[0]?.lifecycle).toBe('done');
  });

  it('is unknown with no startDate at all', () => {
    const order = amplasare({ startDate: null, endDate: null });
    expect(build([order]).points[0]?.lifecycle).toBe('unknown');
  });
});

describe('lifecycle — Ridicari/Igienizari, date-only', () => {
  it('is upcoming for a future pickup', () => {
    const order = ridicare({ pickupDate: FUTURE });
    expect(build([order]).points[0]?.lifecycle).toBe('upcoming');
  });

  it('is active for a pickup dated today', () => {
    const order = ridicare({ pickupDate: TODAY });
    expect(build([order]).points[0]?.lifecycle).toBe('active');
  });

  it('is done for a pickup already in the past', () => {
    const order = ridicare({ pickupDate: PAST });
    expect(build([order]).points[0]?.lifecycle).toBe('done');
  });

  it('is upcoming for a future sanitation visit', () => {
    const order = igienizare({ sanitationDate: FUTURE });
    expect(build([order]).points[0]?.lifecycle).toBe('upcoming');
  });

  it('is done for a sanitation visit already in the past', () => {
    const order = igienizare({ sanitationDate: PAST });
    expect(build([order]).points[0]?.lifecycle).toBe('done');
  });

  it('is unknown with no date and no tasks', () => {
    const order = ridicare({ pickupDate: null });
    expect(build([order]).points[0]?.lifecycle).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Lifecycle — task evidence
// ---------------------------------------------------------------------------

describe('lifecycle — task evidence beats dates', () => {
  it('is done when every task is COMPLETED, even if the date says upcoming', () => {
    const order = amplasare({ startDate: FUTURE, endDate: null });
    const t = forOrder(task({ status: 'COMPLETED' }), order);
    expect(build([order], [t]).points[0]?.lifecycle).toBe('done');
  });

  it('is active when any task is IN_PROGRESS, even if the date says done', () => {
    const order = ridicare({ pickupDate: PAST });
    const t = forOrder(task({ status: 'IN_PROGRESS' }), order);
    expect(build([order], [t]).points[0]?.lifecycle).toBe('active');
  });

  it('one IN_PROGRESS among several tasks still wins over any COMPLETED', () => {
    const order = igienizare({ sanitationDate: PAST });
    const tasks = [
      forOrder(task({ status: 'COMPLETED' }), order),
      forOrder(task({ status: 'IN_PROGRESS' }), order),
    ];
    expect(build([order], tasks).points[0]?.lifecycle).toBe('active');
  });

  it('overdue: anchor date passed and the only task is still NEW', () => {
    const order = ridicare({ pickupDate: PAST });
    const t = forOrder(task({ status: 'NEW' }), order);
    expect(build([order], [t]).points[0]?.lifecycle).toBe('overdue');
  });

  it('is NOT overdue when the NEW task exists but the anchor date has not arrived', () => {
    const order = ridicare({ pickupDate: FUTURE });
    const t = forOrder(task({ status: 'NEW' }), order);
    expect(build([order], [t]).points[0]?.lifecycle).toBe('upcoming');
  });

  it('a past date with NO tasks is plain "done", not "overdue"', () => {
    // overdue requires open task evidence — an order nobody ever dispatched a
    // task for is just a finished plan, not a stuck one.
    const order = ridicare({ pickupDate: PAST });
    expect(build([order]).points[0]?.lifecycle).toBe('done');
  });

  it('taskStatus on the point summarises to COMPLETED only when all tasks are', () => {
    const order = amplasare({ startDate: PAST, endDate: FUTURE });
    const tasks = [forOrder(task({ status: 'COMPLETED' }), order), forOrder(task({ status: 'NEW' }), order)];
    expect(build([order], tasks).points[0]?.taskStatus).toBe('NEW');
  });
});

// ---------------------------------------------------------------------------
// Dropped orders
// ---------------------------------------------------------------------------

describe('dropped orders', () => {
  it('reports "missing" for a null coordinate string', () => {
    const order = amplasare({ locationCoordinates: null });
    const result = build([order]);
    expect(result.points).toHaveLength(0);
    expect(result.droppedOrders).toEqual([
      expect.objectContaining({ orderId: order.id, reason: 'missing' }),
    ]);
  });

  it('reports "missing" for an empty/blank coordinate string', () => {
    const order = ridicare({ pickupLocationCoordinates: '   ' });
    expect(build([order]).droppedOrders[0]?.reason).toBe('missing');
  });

  it('reports "malformed" for a present but unparseable coordinate string', () => {
    const order = igienizare({ sanitationLocationCoordinates: 'not-a-coordinate' });
    const result = build([order]);
    expect(result.points).toHaveLength(0);
    expect(result.droppedOrders[0]).toEqual(
      expect.objectContaining({ orderId: order.id, reason: 'malformed' }),
    );
  });

  it('a valid coordinate order is plotted, not dropped', () => {
    const order = amplasare();
    const result = build([order]);
    expect(result.points).toHaveLength(1);
    expect(result.droppedOrders).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

describe('routes', () => {
  it('produces no line for a route with only one usable stop', () => {
    const r = route({
      tasks: [task({ coordinates: POINTS.bucuresti }), task({ coordinates: null })],
    });
    expect(build([], [], [r]).routes).toHaveLength(0);
  });

  it('produces a line for a route with two or more usable stops', () => {
    const r = route({
      tasks: [task({ coordinates: POINTS.bucuresti }), task({ coordinates: POINTS.otopeni })],
    });
    expect(build([], [], [r]).routes).toHaveLength(1);
  });

  it('orders stops by orderIndex and numbers seq from 1', () => {
    const first = task({ coordinates: POINTS.bucuresti, orderIndex: 2, clientName: 'Second physically' });
    const second = task({ coordinates: POINTS.otopeni, orderIndex: 0, clientName: 'First physically' });
    const r = route({ tasks: [first, second] });
    const [line] = build([], [], [r]).routes;
    expect(line?.stops.map((s) => s.label)).toEqual(['First physically', 'Second physically']);
    expect(line?.stops.map((s) => s.seq)).toEqual([1, 2]);
  });

  it('totalKm matches an independently computed haversine distance', () => {
    const r = route({
      tasks: [task({ coordinates: POINTS.bucuresti, orderIndex: 0 }), task({ coordinates: POINTS.otopeni, orderIndex: 1 })],
    });
    const [line] = build([], [], [r]).routes;
    expect(line?.totalKm).toBeCloseTo(BUCURESTI_OTOPENI_KM, 5);
  });

  it('counts stops with no coordinates as droppedStops, not as stops', () => {
    const r = route({
      tasks: [
        task({ coordinates: POINTS.bucuresti }),
        task({ coordinates: POINTS.otopeni }),
        task({ coordinates: null }),
      ],
    });
    const [line] = build([], [], [r]).routes;
    expect(line?.stops).toHaveLength(2);
    expect(line?.droppedStops).toBe(1);
  });

  it('assigns colours by sorted route id, stable regardless of input order', () => {
    const twoStops = () => [task({ coordinates: POINTS.bucuresti }), task({ coordinates: POINTS.otopeni })];
    const low = route({ id: 1, tasks: twoStops() });
    const high = route({ id: 9, tasks: twoStops() });
    const forward = build([], [], [low, high]).routes;
    const reversed = build([], [], [high, low]).routes;
    const colorOf = (lines: typeof forward, id: number) => lines.find((l) => l.routeId === id)?.color;
    expect(colorOf(forward, 1)).toBe(colorOf(reversed, 1));
    expect(colorOf(forward, 9)).toBe(colorOf(reversed, 9));
    expect(colorOf(forward, 1)).not.toBe(colorOf(forward, 9));
  });
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe('filters', () => {
  it('empty filters (EMPTY_FILTERS) constrain nothing', () => {
    const orders = [amplasare(), ridicare(), igienizare()];
    expect(build(orders).points).toHaveLength(3);
  });

  it('orderTypes narrows to the listed types only', () => {
    const orders = [amplasare(), ridicare(), igienizare()];
    const filters: MapFilters = { ...EMPTY_FILTERS, orderTypes: ['Ridicari'] };
    const result = build(orders, [], [], filters);
    expect(result.points.map((p) => p.orderType)).toEqual(['Ridicari']);
  });

  it('lifecycles narrows to the listed lifecycles only', () => {
    const orders = [
      amplasare({ startDate: FUTURE, endDate: null }), // upcoming
      ridicare({ pickupDate: PAST }), // done
    ];
    const filters: MapFilters = { ...EMPTY_FILTERS, lifecycles: ['done'] };
    const result = build(orders, [], [], filters);
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.lifecycle).toBe('done');
  });

  it('counties narrows to points whose resolved route county matches', () => {
    const ilfov = route({ county: 'Ilfov' });
    const cluj = route({ county: 'Cluj' });
    const orderIlfov = amplasare();
    const orderCluj = amplasare();
    const tasks = [
      forOrder(task({ route: ilfov }), orderIlfov),
      forOrder(task({ route: cluj }), orderCluj),
    ];
    const filters: MapFilters = { ...EMPTY_FILTERS, counties: ['Cluj'] };
    const result = build([orderIlfov, orderCluj], tasks, [ilfov, cluj], filters);
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.orderId).toBe(orderCluj.id);
  });

  it('routeIds narrows to points whose order resolves to one of the given routes', () => {
    const r1 = route();
    const r2 = route();
    const onR1 = amplasare();
    const onR2 = amplasare();
    const tasks = [forOrder(task({ route: r1 }), onR1), forOrder(task({ route: r2 }), onR2)];
    const filters: MapFilters = { ...EMPTY_FILTERS, routeIds: [r1.id] };
    const result = build([onR1, onR2], tasks, [r1, r2], filters);
    expect(result.points.map((p) => p.orderId)).toEqual([onR1.id]);
  });

  it('routeIds excludes points with no resolved route at all', () => {
    const r1 = route();
    const unrouted = amplasare();
    const filters: MapFilters = { ...EMPTY_FILTERS, routeIds: [r1.id] };
    expect(build([unrouted], [], [r1], filters).points).toHaveLength(0);
  });

  it('from/to date bounds are inclusive', () => {
    const inRange = ridicare({ pickupDate: '2026-06-10' });
    const before = ridicare({ pickupDate: '2026-06-01' });
    const after = ridicare({ pickupDate: '2026-06-20' });
    const filters: MapFilters = { ...EMPTY_FILTERS, from: '2026-06-10', to: '2026-06-10' };
    const result = build([inRange, before, after], [], [], filters);
    expect(result.points.map((p) => p.orderId)).toEqual([inRange.id]);
  });

  it('a date filter excludes points with no date at all', () => {
    const noDate = ridicare({ pickupDate: null });
    const filters: MapFilters = { ...EMPTY_FILTERS, from: PAST };
    expect(build([noDate], [], [], filters).points).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Free-text search
// ---------------------------------------------------------------------------

describe('free-text search', () => {
  it('is diacritic-insensitive: "stefan" finds "Ștefan"', () => {
    const order = amplasare({ client: client({ fullName: 'Ștefan Ionescu' }) });
    const filters: MapFilters = { ...EMPTY_FILTERS, query: 'stefan' };
    expect(build([order], [], [], filters).points).toHaveLength(1);
  });

  it('matches on address', () => {
    const order = amplasare({ locationAddress: 'Bulevardul Timișoara nr. 5' });
    const filters: MapFilters = { ...EMPTY_FILTERS, query: 'timisoara' };
    expect(build([order], [], [], filters).points).toHaveLength(1);
  });

  it('matches on order number', () => {
    const order = amplasare({ number: 4242 });
    const filters: MapFilters = { ...EMPTY_FILTERS, query: '4242' };
    expect(build([order], [], [], filters).points).toHaveLength(1);
  });

  it('an empty query string matches everything', () => {
    const orders = [amplasare(), ridicare()];
    const filters: MapFilters = { ...EMPTY_FILTERS, query: '   ' };
    expect(build(orders, [], [], filters).points).toHaveLength(2);
  });

  it('a non-matching query drops everything', () => {
    const order = amplasare({ client: client({ fullName: 'Ana Pop' }), locationAddress: 'Str. Nicio Legătură' });
    const filters: MapFilters = { ...EMPTY_FILTERS, query: 'zzz-nu-exista' };
    expect(build([order], [], [], filters).points).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

describe('stats', () => {
  it('site grouping treats near-identical coordinates as one site', () => {
    // Both round to 44.4268,26.1025 at 4 decimals despite differing floats.
    const a = amplasare({ locationCoordinates: '44.42676,26.10247', quantity: 3 });
    const b = amplasare({ locationCoordinates: '44.42682,26.10253', quantity: 5 });
    const result = build([a, b]);
    expect(result.stats.topSites).toHaveLength(1);
    expect(result.stats.topSites[0]?.count).toBe(2);
    expect(result.stats.topSites[0]?.quantity).toBe(8);
  });

  it('the literal example from the spec also collapses to one site', () => {
    const a = amplasare({ locationCoordinates: '44.4268,26.1025' });
    const b = amplasare({ locationCoordinates: '44.426800,26.102500' });
    expect(build([a, b]).stats.topSites).toHaveLength(1);
  });

  it('topSites is capped at 8, sorted by quantity descending', () => {
    const orders = Array.from({ length: 10 }, (_, index) =>
      amplasare({
        locationCoordinates: `${(44 + index * 0.1).toFixed(4)},26.1000`,
        quantity: index + 1,
      }),
    );
    const result = build(orders);
    expect(result.stats.topSites).toHaveLength(8);
    expect(result.stats.topSites[0]?.quantity).toBe(10);
    expect(result.stats.topSites[7]?.quantity).toBe(3);
  });

  it('plotted + dropped account for every order passed in', () => {
    const good = amplasare();
    const bad = ridicare({ pickupLocationCoordinates: null });
    const result = build([good, bad]);
    expect(result.stats.plotted).toBe(1);
    expect(result.stats.dropped).toBe(1);
  });

  it('droppedRatio is dropped / (plotted + dropped)', () => {
    const good = [amplasare(), amplasare(), amplasare()];
    const bad = [ridicare({ pickupLocationCoordinates: null })];
    const result = build([...good, ...bad]);
    expect(result.stats.droppedRatio).toBeCloseTo(1 / 4, 10);
  });

  it('droppedRatio is 0 when there is nothing at all', () => {
    expect(build([]).stats.droppedRatio).toBe(0);
  });

  it('byLifecycle counts sum to the plotted total', () => {
    const orders = [
      amplasare({ startDate: FUTURE, endDate: null }),
      ridicare({ pickupDate: PAST }),
      igienizare({ sanitationDate: TODAY }),
    ];
    const result = build(orders);
    const sum = result.stats.byLifecycle.reduce((total, bucket) => total + bucket.count, 0);
    expect(sum).toBe(result.stats.plotted);
  });

  it('byOrderType counts sum to the plotted total', () => {
    const orders = [amplasare(), amplasare(), ridicare()];
    const result = build(orders);
    const sum = result.stats.byOrderType.reduce((total, bucket) => total + bucket.count, 0);
    expect(sum).toBe(result.stats.plotted);
  });

  it('routes.unassignedTasks counts tasks with no route', () => {
    const r = route({ tasks: [] });
    const assigned = task({ route: r });
    const unassigned = task({ route: null });
    const result = build([], [assigned, unassigned], [r]);
    expect(result.stats.routes.unassignedTasks).toBe(1);
  });

  it('routes.count and totalKm reflect only the drawn lines', () => {
    const drawn = route({ tasks: [task({ coordinates: POINTS.bucuresti }), task({ coordinates: POINTS.otopeni })] });
    const tooShort = route({ tasks: [task({ coordinates: POINTS.popesti })] });
    const result = build([], [], [drawn, tooShort]);
    expect(result.stats.routes.count).toBe(1);
    expect(result.stats.routes.totalKm).toBeCloseTo(BUCURESTI_OTOPENI_KM, 5);
  });
});

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

describe('bounds', () => {
  it('is null when there are no points', () => {
    expect(build([]).bounds).toBeNull();
  });

  it('frames exactly the filtered points', () => {
    const a = amplasare({ locationCoordinates: POINTS.bucuresti });
    const b = amplasare({ locationCoordinates: POINTS.otopeni });
    const result = build([a, b]);
    expect(result.bounds).toEqual({
      west: 26.0714,
      east: 26.1025,
      south: 44.4268,
      north: 44.551,
    });
  });
});
