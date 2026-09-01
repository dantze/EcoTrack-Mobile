/**
 * Where an order sits in its life — the ONE definition of "current vs
 * fulfilled" the web app is allowed to have.
 *
 * This started inside `features/map` (it was the axis the "incoming vs done"
 * map views were built on) and moved here when Comenzi needed the same answer
 * to decide what belongs in the Arhivă. Two features asking "is this order
 * finished?" and getting two answers is the failure mode this module exists to
 * prevent, so **do not re-derive `done` anywhere else** — call `isFulfilled`.
 *
 * **This rule is mirrored in Java** by
 * `backend/src/main/java/com/example/damiProd/service/OrderFulfilmentPolicy.java`,
 * which uses it to refuse retiring a subscription that live orders still
 * reference. The two share no code and neither toolchain can see the other, so
 * they are held together by golden cases in `shared/order-lifecycle-cases.json`
 * that BOTH test suites read. **Changing the rule means editing three things:**
 * this file, the Java, and that fixture.
 *
 * It lives in `src/lib` rather than in either feature because a
 * feature-to-feature import would just move the coupling around. Everything
 * here is a pure function of (order, task evidence, today) over
 * `@/types/domain` alone — no API, no React, no map library — which is what
 * makes it unit-testable and what keeps the dependency arrow pointing one way.
 */

import type { Order, Task, TaskStatus } from '@/types/domain';

// ---------------------------------------------------------------------------
// The lifecycle axis
// ---------------------------------------------------------------------------

/**
 * Derived in this module from the order's own dates and the status of the
 * tasks generated from it. This is not a field the backend stores.
 */
export type Lifecycle =
  /** Scheduled, hasn't started. */
  | 'upcoming'
  /** Cabins are on site now / work is under way. */
  | 'active'
  /** Finished — picked up, or every task completed. */
  | 'done'
  /** Past its date with work still open. The queue that actually needs a human. */
  | 'overdue'
  /** Not enough dates to say. */
  | 'unknown';

export const LIFECYCLES: readonly Lifecycle[] = [
  'upcoming',
  'active',
  'overdue',
  'done',
  'unknown',
];

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  upcoming: 'Programate',
  active: 'În desfășurare',
  overdue: 'Întârziate',
  done: 'Finalizate',
  unknown: 'Fără dată',
};

// ---------------------------------------------------------------------------
// Anchor date
// ---------------------------------------------------------------------------

/**
 * The date the order is *about* — used for sorting, filtering, display and as
 * the fallback lifecycle evidence below.
 *
 * Re-exported from `features/sales/orderModel` under its original name, which
 * is where most callers still import it from.
 */
export function orderPrimaryDate(order: Order): string | null {
  switch (order.orderType) {
    case 'Amplasari':
      return order.startDate;
    case 'Ridicari':
      return order.pickupDate;
    case 'Igienizari':
      return order.sanitationDate;
  }
}

// ---------------------------------------------------------------------------
// Task evidence
// ---------------------------------------------------------------------------

/**
 * One status to represent however many tasks an order produced.
 *
 * Deliberately the same shape the backend's `GET /tasks/order/{id}/exists`
 * returns, so a caller that only has that summary (Comenzi fans it out per
 * order; there is no batch endpoint) and a caller that has the full task list
 * (the map loads every task anyway) feed the SAME derivation rather than two
 * lookalike ones.
 */
export function summarizeTaskStatus(tasks: readonly Task[]): TaskStatus | null {
  if (tasks.length === 0) return null;
  if (tasks.every((task) => task.status === 'COMPLETED')) return 'COMPLETED';
  if (tasks.some((task) => task.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
  return 'NEW';
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/**
 * Task evidence outranks dates because a task's status is what a technician
 * actually reported on site, while a date is only the plan. An order can be
 * completed early or start late; the moment there is a task, its status is
 * the better source of truth.
 *
 * `taskStatus` is `null` when the order has produced no tasks at all — NOT the
 * same as "the tasks are all NEW", which is itself a signal (see below).
 */
export function deriveLifecycle(
  order: Order,
  taskStatus: TaskStatus | null,
  today: string,
): Lifecycle {
  if (taskStatus === 'COMPLETED') return 'done';
  if (taskStatus === 'IN_PROGRESS') return 'active';

  if (taskStatus === 'NEW') {
    // Nobody has finished any of this order's work. If the anchor date is
    // already behind us, that silence IS the signal — this is the queue a
    // dispatcher needs to look at, not just another "upcoming".
    const anchor = orderPrimaryDate(order);
    if (anchor && anchor < today) return 'overdue';
    // Anchor is today or in the future (or missing): no verdict from tasks
    // yet, so fall through to the same date reasoning an order with no tasks
    // at all would get.
  }

  return deriveLifecycleFromDates(order, today);
}

/** Convenience wrapper for callers holding the order's actual tasks. */
export function deriveLifecycleFromTasks(
  order: Order,
  tasks: readonly Task[],
  today: string,
): Lifecycle {
  return deriveLifecycle(order, summarizeTaskStatus(tasks), today);
}

/**
 * Every comparison below is a plain string compare, which is only meaningful
 * for well-formed ISO dates — `'2026-09-01' < '2026-09-02'` holds, but so does
 * `'2026-09-01' < 'nu se stie'`, which would file a garbage date under
 * *upcoming* instead of *unknown*.
 *
 * The backend mirror (`OrderFulfilmentPolicy.parse`) runs `LocalDate.parse` and
 * treats anything unparseable as absent, so this has to do the same or the two
 * disagree. Found by the shared golden cases, which is exactly what they are
 * for — the boolean still agreed, so nothing else would have caught it.
 */
function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  // Shape alone accepts 2026-02-31; Date rejects it by rolling over.
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === trimmed ? trimmed : null;
}

/**
 * Scheduling-only lifecycle, used when there is no conclusive task evidence.
 * Amplasari gets a window (start..end) because a placement occupies a site
 * for a stretch of time; Ridicari/Igienizari are single-instant visits, so
 * they only have a before/after.
 */
function deriveLifecycleFromDates(order: Order, today: string): Lifecycle {
  if (order.orderType === 'Amplasari') {
    const start = isoDate(order.startDate);
    if (!start) return 'unknown';
    if (today < start) return 'upcoming';
    // An indefinite contract has no end to compare against, which reads the
    // same as an end date that has not arrived yet: still active.
    const end = order.isIndefinite ? null : isoDate(order.endDate);
    if (!end || today <= end) return 'active';
    return 'done';
  }

  const date = isoDate(orderPrimaryDate(order));
  if (!date) return 'unknown';
  if (today < date) return 'upcoming';
  // A pickup/sanitation visit dated today is being worked, not merely
  // "coming up" — there is no separate task evidence here to say otherwise.
  if (today === date) return 'active';
  return 'done';
}

// ---------------------------------------------------------------------------
// Fulfilled / archived
// ---------------------------------------------------------------------------

/**
 * **The rule.** An order is fulfilled — and therefore belongs in Comenzi's
 * Arhivă rather than in the working list — exactly when its lifecycle is
 * `'done'`:
 *
 * 1. it has tasks and **every one of them is COMPLETED**; or
 * 2. it has **no conclusive task evidence** (no tasks at all, or only NEW ones
 *    whose anchor date has not passed) and its dates put it in the past —
 *    an Amplasare whose `endDate` is behind us and which is not indefinite, or
 *    a Ridicare/Igienizare whose date is strictly before today.
 *
 * Everything else is current, including every order with an open task and
 * every order with too few dates to judge (`'unknown'`). The asymmetry is
 * intentional: hiding live work is a much worse error than leaving a finished
 * order on the list one day longer.
 *
 * Archiving is therefore DERIVED, never stored — an order leaves the archive
 * by its tasks changing, not by an "un-archive" button.
 */
export function isFulfilled(
  order: Order,
  taskStatus: TaskStatus | null,
  today: string,
): boolean {
  return deriveLifecycle(order, taskStatus, today) === 'done';
}
