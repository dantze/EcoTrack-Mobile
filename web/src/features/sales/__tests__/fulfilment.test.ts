/**
 * `isOrderFulfilled` — the one definition of "this order's work is finished",
 * shared by the Arhivă split (TODO-21) and, on the backend, by the guard that
 * refuses to retire a subscription live orders still point at (TODO-20).
 *
 * The rule has to fail safe in both places: only a COMPLETED task retires an
 * order. Everything else — no task, an unloaded status, work in progress —
 * keeps it in front of the operator.
 */

import { describe, expect, it } from 'vitest';
import { isOrderFulfilled } from '../orderModel';

describe('isOrderFulfilled', () => {
  it('is true only for a COMPLETED task', () => {
    expect(isOrderFulfilled('COMPLETED')).toBe(true);
    expect(isOrderFulfilled('IN_PROGRESS')).toBe(false);
    expect(isOrderFulfilled('NEW')).toBe(false);
  });

  it('treats an order with no task as unfinished — the date does not decide', () => {
    // `null` is what `useOrderTaskStatuses` stores for an order with no task.
    // A past date makes such an order 'done' to the map's deriveLifecycle; here
    // it must stay current, because nobody ever carried it out.
    expect(isOrderFulfilled(null)).toBe(false);
  });

  it('treats a status that has not loaded as unfinished', () => {
    // An order is only ever hidden from Comenzi on positive evidence: a failed
    // or in-flight status lookup must not archive it.
    expect(isOrderFulfilled(undefined)).toBe(false);
  });
});
