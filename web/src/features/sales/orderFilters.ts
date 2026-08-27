/**
 * Which orders Comenzi shows, and on which tab.
 *
 * `OrdersPage` owns a lot at once — filter state, deep links, columns, three
 * drawers — and exactly one part of it is a question about data rather than
 * about rendering: given every order, which ones survive the filter strip, and
 * which half of the Curente/Arhivă split does each survivor land in. That part
 * lives here so it can be read, and tested, without a DOM.
 *
 * The split is DERIVED, never stored (TODO-21): `isOrderFulfilled` in
 * `./orderModel` is the single rule — a COMPLETED task and nothing else — and
 * it deliberately disagrees with `deriveLifecycle` in `@/features/map/data.ts`,
 * whose date fallback would archive an order nobody ever executed.
 */

import { clientName, type Order } from '@/types/domain';
import { matchesQuery } from '@/lib/search';
import type { OrderTaskStatusMap } from './queries';
import { isOrderFulfilled, orderAddress, orderPrimaryDate, orderSummary } from './orderModel';

/** The filter strip's state, exactly as the screen holds it. */
export interface OrderFilters {
  search: string;
  /** An `orderType` tag, or '' for every type. */
  type: string;
  /** A client id as a string — it comes from a `<Select>` — or '' for everyone. */
  clientId: string;
  /** Inclusive ISO bounds on the order's primary date; null is unbounded. */
  from: string | null;
  to: string | null;
}

export const NO_ORDER_FILTERS: OrderFilters = {
  search: '',
  type: '',
  clientId: '',
  from: null,
  to: null,
};

/** Is anything narrowing the list right now — i.e. is "Resetează" worth offering? */
export function hasActiveFilters(filters: OrderFilters): boolean {
  return (
    filters.search !== '' ||
    filters.type !== '' ||
    filters.clientId !== '' ||
    filters.from !== null ||
    filters.to !== null
  );
}

function matchesFilters(order: Order, filters: OrderFilters): boolean {
  // Diacritic-insensitive: a typed "bucuresti" has to find "București".
  if (
    !matchesQuery(
      filters.search,
      String(order.number),
      clientName(order.client),
      orderAddress(order),
      orderSummary(order),
    )
  ) {
    return false;
  }
  if (filters.type && order.orderType !== filters.type) return false;
  if (filters.clientId && String(order.client.id) !== filters.clientId) return false;
  if (filters.from || filters.to) {
    const date = orderPrimaryDate(order);
    // An order with no date cannot satisfy a date range; it is not "before" it.
    if (!date) return false;
    const day = date.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
  }
  return true;
}

/**
 * The orders the filter strip lets through, BEFORE the Curente/Arhivă split —
 * so each tab can report how many of the matches landed on its side.
 */
export function filterOrders(orders: readonly Order[], filters: OrderFilters): Order[] {
  return orders.filter((order) => matchesFilters(order, filters));
}

export interface OrderSplit {
  /** Work still in front of the operator. */
  current: Order[];
  /** Finished work — Arhivă. */
  archived: Order[];
}

/**
 * Partitions on fulfilment, preserving the incoming order in both halves.
 *
 * `taskStatuses` may be undefined while the per-order status query is in
 * flight, and an individual entry may be `null` for an order with no task at
 * all. Both read as "not fulfilled", so an order only ever leaves Curente on
 * positive evidence.
 */
export function splitByFulfilment(
  orders: readonly Order[],
  taskStatuses: OrderTaskStatusMap | undefined,
): OrderSplit {
  const current: Order[] = [];
  const archived: Order[] = [];
  for (const order of orders) {
    if (isOrderFulfilled(taskStatuses?.[order.id])) archived.push(order);
    else current.push(order);
  }
  return { current, archived };
}
