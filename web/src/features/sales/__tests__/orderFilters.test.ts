/**
 * The two derivations behind the Comenzi table, tested without a screen.
 *
 * `OrdersPage.test.tsx` still exercises the split end to end against the mock
 * API — that is the test that proves the wiring. These cover the edges that
 * seeded data cannot be relied on to contain: a diacritic-folded search, an
 * order with no date meeting a date range, and a status map that has not
 * loaded yet.
 */

import { describe, expect, it } from 'vitest';
import type { Order } from '@/types/domain';
import {
  NO_ORDER_FILTERS,
  filterOrders,
  hasActiveFilters,
  splitByFulfilment,
} from '../orderFilters';

/** A minimal Amplasare, shaped enough for the filters to read it. */
function order(id: number, overrides: Record<string, unknown> = {}): Order {
  return {
    id,
    number: id,
    orderType: 'Amplasari',
    client: { id: 1, type: 'individual', fullName: 'Ștefan Popescu' },
    contact: null,
    details: null,
    product: { id: 7, name: 'Toaletă ecologică' },
    quantity: 1,
    isIndefinite: false,
    durationDays: 30,
    startDate: '2026-03-12',
    endDate: '2026-04-11',
    locationAddress: 'Str. Berzei 4, București',
    locationCoordinates: null,
    igienizariPerMonth: 1,
    ...overrides,
  } as unknown as Order;
}

describe('hasActiveFilters', () => {
  it('is false only when nothing is narrowing the list', () => {
    expect(hasActiveFilters(NO_ORDER_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_ORDER_FILTERS, search: 'a' })).toBe(true);
    expect(hasActiveFilters({ ...NO_ORDER_FILTERS, type: 'Ridicari' })).toBe(true);
    expect(hasActiveFilters({ ...NO_ORDER_FILTERS, clientId: '1' })).toBe(true);
    expect(hasActiveFilters({ ...NO_ORDER_FILTERS, from: '2026-01-01' })).toBe(true);
    expect(hasActiveFilters({ ...NO_ORDER_FILTERS, to: '2026-01-01' })).toBe(true);
  });
});

describe('filterOrders', () => {
  const orders = [
    order(1),
    order(2, { client: { id: 2, type: 'company', name: 'Acme SRL' } }),
  ];

  it('keeps everything when no filter is set', () => {
    expect(filterOrders(orders, NO_ORDER_FILTERS)).toHaveLength(2);
  });

  it('folds diacritics both ways, so "bucuresti" finds "București"', () => {
    const hits = filterOrders(orders, { ...NO_ORDER_FILTERS, search: 'bucuresti' });
    expect(hits.map((hit) => hit.id)).toEqual([1, 2]);
    expect(filterOrders(orders, { ...NO_ORDER_FILTERS, search: 'stefan' })).toHaveLength(1);
  });

  it('searches the order number and the summary, not just the client', () => {
    expect(filterOrders(orders, { ...NO_ORDER_FILTERS, search: '2' })).toHaveLength(1);
    expect(filterOrders(orders, { ...NO_ORDER_FILTERS, search: 'toaleta' })).toHaveLength(2);
  });

  it('narrows by type and by client id', () => {
    expect(filterOrders(orders, { ...NO_ORDER_FILTERS, type: 'Ridicari' })).toHaveLength(0);
    expect(filterOrders(orders, { ...NO_ORDER_FILTERS, clientId: '2' })).toHaveLength(1);
  });

  it('treats the date bounds as inclusive', () => {
    const bounds = { ...NO_ORDER_FILTERS, from: '2026-03-12', to: '2026-03-12' };
    expect(filterOrders(orders, bounds)).toHaveLength(2);
    expect(filterOrders(orders, { ...NO_ORDER_FILTERS, from: '2026-03-13' })).toHaveLength(0);
  });

  it('drops an order with no date once a range is set, but not before', () => {
    // A dateless order cannot satisfy a range — it is not "before" it either.
    const dateless = [order(3, { startDate: null })];
    expect(filterOrders(dateless, NO_ORDER_FILTERS)).toHaveLength(1);
    expect(filterOrders(dateless, { ...NO_ORDER_FILTERS, from: '2026-01-01' })).toHaveLength(0);
  });
});

describe('splitByFulfilment', () => {
  const orders = [order(1), order(2), order(3)];

  it('archives only the orders with a COMPLETED task', () => {
    const split = splitByFulfilment(orders, { 1: 'COMPLETED', 2: 'IN_PROGRESS', 3: null });
    expect(split.archived.map((entry) => entry.id)).toEqual([1]);
    expect(split.current.map((entry) => entry.id)).toEqual([2, 3]);
  });

  it('keeps everything current while the status map is still loading', () => {
    // An order is only ever hidden from Comenzi on positive evidence.
    const split = splitByFulfilment(orders, undefined);
    expect(split.current).toHaveLength(3);
    expect(split.archived).toHaveLength(0);
  });

  it('loses and duplicates nothing', () => {
    const split = splitByFulfilment(orders, { 1: 'COMPLETED' });
    expect(split.current.length + split.archived.length).toBe(orders.length);
  });
});
