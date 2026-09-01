/**
 * The calendar grid itself — one chunky tile per day, laid out like an advent
 * calendar: the date on the lid, what is behind it printed underneath.
 *
 * Presentational on purpose. It takes the cells and the day buckets already
 * computed by `../calendar` and reports clicks, so the whole layout can be
 * tested without a QueryClient, a router or a network.
 *
 * Only days that actually hold orders are buttons. An empty day is a plain div:
 * a month has ~20 of them, and putting 20 dead stops in the tab order for the
 * keyboard user who wants the one busy Thursday is worse than useless.
 */

import { WEEKDAY_LABELS, orderCountLabel, orderTypeCountLabel } from '@/components/domain';
import { ORDER_TYPES, type OrderTypeTag } from '@/types/domain';
import { cx } from '@/components/ui';
import { type CalendarCell, type DayBucket, dayLabel } from '../calendar';

/** Same three tones `OrderTypeBadge` uses, reduced to a dot. */
const TYPE_DOT: Record<OrderTypeTag, string> = {
  Amplasari: 'bg-info-600',
  Ridicari: 'bg-ink-muted',
  Igienizari: 'bg-success-600',
};

export interface MonthGridProps {
  cells: CalendarCell[];
  buckets: ReadonlyMap<string, DayBucket>;
  /** The day whose panel is open, highlighted so the tile keeps its place. */
  selectedIso: string | null;
  onSelectDay: (iso: string) => void;
}

function DaySummary({ counts }: { counts: DayBucket['counts'] }) {
  return (
    <ul className="mt-1.5 flex flex-col gap-0.5">
      {ORDER_TYPES.filter((type) => counts[type] > 0).map((type) => (
        <li key={type} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', TYPE_DOT[type])} />
          <span className="truncate">
            <span className="tabular font-medium text-ink">{counts[type]}</span>{' '}
            {orderTypeCountLabel(type, counts[type])}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DayTile({
  cell,
  bucket,
  selected,
  onSelect,
}: {
  cell: CalendarCell;
  bucket: DayBucket | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const shell = cx(
    'flex min-h-[6.5rem] flex-col rounded-xl border p-2 text-left transition',
    cell.inMonth ? 'border-border bg-white' : 'border-border/60 bg-surface-sunken/60',
    cell.isWeekend && cell.inMonth && 'bg-surface-sunken',
    cell.isToday && 'ring-2 ring-brand-400',
    selected && 'border-brand-500 ring-2 ring-brand-500',
  );

  const number = (
    <span
      className={cx(
        'tabular text-lg leading-none font-semibold',
        cell.inMonth ? 'text-ink' : 'text-ink-subtle',
        cell.isToday && 'text-brand-600',
      )}
    >
      {cell.dayOfMonth}
    </span>
  );

  if (!bucket) {
    return (
      <div className={shell} aria-current={cell.isToday ? 'date' : undefined}>
        {number}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-haspopup="dialog"
      aria-current={cell.isToday ? 'date' : undefined}
      aria-label={`${dayLabel(cell.iso)} — ${orderCountLabel(bucket.total)}`}
      className={cx(
        shell,
        'cursor-pointer hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-popover',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
      )}
    >
      <span className="flex items-start justify-between gap-1">
        {number}
        <span className="tabular inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-700 px-1.5 py-0.5 text-[0.6875rem] leading-none font-semibold text-white">
          {bucket.total}
        </span>
      </span>
      <DaySummary counts={bucket.counts} />
    </button>
  );
}

export function MonthGrid({ cells, buckets, selectedIso, onSelectDay }: MonthGridProps) {
  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-2">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 text-[0.6875rem] font-semibold tracking-wide text-ink-subtle uppercase"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell) => (
          <DayTile
            key={cell.iso}
            cell={cell}
            bucket={buckets.get(cell.iso)}
            selected={cell.iso === selectedIso}
            onSelect={() => onSelectDay(cell.iso)}
          />
        ))}
      </div>
    </div>
  );
}
