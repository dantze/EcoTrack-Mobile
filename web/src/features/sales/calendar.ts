/**
 * Month-grid shaping for the Comenzi calendar — pure, so the date arithmetic is
 * testable without rendering anything.
 *
 * Three decisions are load-bearing:
 *
 * 1. **Weeks start Monday**, like `weekStartIso` in the Technical module and
 *    like `Route.dayOfWeek` (1 = Monday, per java.time.DayOfWeek). A calendar
 *    that started on Sunday would put a job in a different column than the Rute
 *    screen puts the same day.
 * 2. **A day owns an ORDER when it is that order's primary date** —
 *    `orderPrimaryDate`, the same definition Comenzi already sorts and filters
 *    on. So an Amplasare sits on the day the cabins go out, not on every day of
 *    its rental window: the window is a contract, the placement is the work.
 *    Reusing the definition is the point — a second one that disagreed would
 *    show an order in the table and hide it in the calendar.
 * 3. **Orders, not tasks** (see OQ-1 in TODO.md). A `Task` is the driver-facing
 *    execution of an order and lives on a weekly route; it has no calendar date
 *    of its own that Sales owns. This screen is the Vânzări view — what was
 *    sold, and when it is due — so a cell counts orders. The task's *status* is
 *    still shown per order inside the day panel, which is where "is it done"
 *    becomes a question worth answering.
 *
 * All arithmetic goes through local `Date`s and `toIsoDate`, never `new
 * Date(iso)` on a bare "YYYY-MM-DD" (that parses as UTC) — otherwise a day cell
 * east of Greenwich picks up the previous day's orders.
 */

import { type Order, type OrderTypeTag } from '@/types/domain';
// The Technical module owns the ISO-date helpers, and there is one definition
// of "which Monday is this" in the app on purpose — see the note above.
import { toIsoDate, todayIso } from '@/features/technical/utils';
import { orderPrimaryDate } from './orderModel';

export interface CalendarCell {
  /** ISO date, "YYYY-MM-DD". */
  iso: string;
  dayOfMonth: number;
  /** False for the leading/trailing days borrowed from the adjacent months. */
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export type OrderCounts = Record<OrderTypeTag, number>;

export interface DayBucket {
  iso: string;
  /** Every order due that day, ordered by their human-facing number. */
  orders: Order[];
  counts: OrderCounts;
  total: number;
}

/** Local midnight — `new Date("2026-08-14")` alone would be UTC midnight. */
function fromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

// ---------------------------------------------------------------------------
// Months
// ---------------------------------------------------------------------------

/** First day of the month containing `date`, as ISO. */
export function monthStartIso(date: Date = new Date()): string {
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

/**
 * `delta` months from `monthIso`, still pinned to day 1.
 *
 * Safe across year boundaries and across month lengths precisely because the
 * input is always the 1st: `new Date(y, m + 1, 1)` cannot land on "31 February"
 * the way shifting an arbitrary day would.
 */
export function shiftMonth(monthIso: string, delta: number): string {
  const start = fromIso(monthIso);
  return toIsoDate(new Date(start.getFullYear(), start.getMonth() + delta, 1));
}

const monthFormatter = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' });

const dayFormatter = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Romanian month names are lowercase; a heading wants the capital. */
function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "August 2026". */
export function monthLabel(monthIso: string): string {
  return capitalise(monthFormatter.format(fromIso(monthIso)));
}

/** "Vineri, 14 august 2026" — the day panel's title. */
export function dayLabel(iso: string): string {
  return capitalise(dayFormatter.format(fromIso(iso)));
}

/**
 * The month's grid: whole weeks, Monday-first, padded at both ends with the
 * adjacent months' days so every row has seven cells. Five or six rows
 * depending on the month — never a blank trailing week.
 */
export function buildMonthGrid(monthIso: string, today: string = todayIso()): CalendarCell[] {
  const start = fromIso(monthIso);
  const year = start.getFullYear();
  const month = start.getMonth();

  const jsDay = start.getDay(); // 0 = Sunday
  const leading = jsDay === 0 ? 6 : jsDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7;

  const cells: CalendarCell[] = [];
  for (let index = 0; index < cellCount; index += 1) {
    // Day-of-month arithmetic rather than millisecond addition, so the 25-hour
    // DST night in late October does not shift the rest of the grid.
    const date = new Date(year, month, 1 - leading + index);
    const iso = toIsoDate(date);
    const weekday = date.getDay();
    cells.push({
      iso,
      dayOfMonth: date.getDate(),
      inMonth: date.getFullYear() === year && date.getMonth() === month,
      isToday: iso === today,
      isWeekend: weekday === 0 || weekday === 6,
    });
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Orders per day
// ---------------------------------------------------------------------------

function emptyCounts(): OrderCounts {
  return { Amplasari: 0, Ridicari: 0, Igienizari: 0 };
}

/**
 * Buckets orders by their primary date. Orders with no primary date belong to
 * no day and are dropped — the same thing the Comenzi date filter does with
 * them, rather than inventing a day for them here.
 */
export function groupOrdersByDay(orders: readonly Order[]): Map<string, DayBucket> {
  const buckets = new Map<string, DayBucket>();

  for (const order of orders) {
    const date = orderPrimaryDate(order);
    if (!date) continue;
    const iso = date.slice(0, 10);
    let bucket = buckets.get(iso);
    if (!bucket) {
      bucket = { iso, orders: [], counts: emptyCounts(), total: 0 };
      buckets.set(iso, bucket);
    }
    bucket.orders.push(order);
    bucket.counts[order.orderType] += 1;
    bucket.total += 1;
  }

  for (const bucket of buckets.values()) {
    bucket.orders.sort((left, right) => left.number - right.number);
  }
  return buckets;
}

/** How many orders the grid's own month holds — the borrowed days excluded. */
export function monthTotal(
  cells: readonly CalendarCell[],
  buckets: ReadonlyMap<string, DayBucket>,
): number {
  return cells.reduce(
    (total, cell) => (cell.inMonth ? total + (buckets.get(cell.iso)?.total ?? 0) : total),
    0,
  );
}
