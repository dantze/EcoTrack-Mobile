/**
 * The month as an agenda: only the days that have work, in order.
 *
 * This is what the 7-column grid becomes below 768px, where seven columns give
 * each day ~50px and the tiles stop being readable. It is also offered as a
 * deliberate view on a wide screen, because "what is coming up" is a different
 * question from "how loaded is next Tuesday", and a list answers it better.
 *
 * Same inputs as `MonthGrid` — the cells and buckets `../calendar` already
 * computed — so the two views cannot disagree about which day an order is on.
 */

import { orderCountLabel, orderTypeCountLabel } from '@/components/domain';
import { ORDER_TYPES, type OrderTypeTag } from '@/types/domain';
import { cn } from '@/lib/utils';
import { type CalendarCell, type DayBucket, dayLabel } from '../calendar';

/** Same three tones `OrderTypeBadge` uses, reduced to a dot. */
const TYPE_DOT: Record<OrderTypeTag, string> = {
  Amplasari: 'bg-info-600',
  Ridicari: 'bg-ink-muted',
  Igienizari: 'bg-success-600',
};

export interface MonthAgendaProps {
  cells: CalendarCell[];
  buckets: ReadonlyMap<string, DayBucket>;
  selectedIso: string | null;
  onSelectDay: (iso: string) => void;
  /** Shown when the month holds nothing at all. */
  emptyLabel: string;
}

export function MonthAgenda({
  cells,
  buckets,
  selectedIso,
  onSelectDay,
  emptyLabel,
}: MonthAgendaProps) {
  // Borrowed days from the adjacent months belong to the grid's shape, not to
  // this month's agenda — a list has no rows to fill out.
  const days = cells
    .filter((cell) => cell.inMonth)
    .map((cell) => ({ cell, bucket: buckets.get(cell.iso) }))
    .filter((entry) => entry.bucket !== undefined && entry.bucket.total > 0);

  if (days.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      {days.map(({ cell, bucket }) => {
        const selected = cell.iso === selectedIso;
        return (
          <li key={cell.iso}>
            <button
              type="button"
              onClick={() => onSelectDay(cell.iso)}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected ? 'bg-surface-active' : 'hover:bg-surface-hover',
              )}
            >
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-lg',
                  cell.isToday
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-sunken text-ink',
                )}
              >
                <span className="tabular text-sm leading-none font-semibold">
                  {cell.dayOfMonth}
                </span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {dayLabel(cell.iso)}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {ORDER_TYPES.filter((type) => bucket!.counts[type] > 0).map((type) => (
                    <span key={type} className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <span
                        aria-hidden
                        className={cn('size-1.5 shrink-0 rounded-full', TYPE_DOT[type])}
                      />
                      {orderTypeCountLabel(type, bucket!.counts[type])}
                    </span>
                  ))}
                </span>
              </span>

              <span className="shrink-0 text-xs text-ink-subtle">
                {orderCountLabel(bucket!.total)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
