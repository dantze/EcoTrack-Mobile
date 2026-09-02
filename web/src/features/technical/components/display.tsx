/**
 * Small presentational pieces shared across the Technical screens.
 *
 * Nothing here fetches. Enum labels come from `@/components/domain`, and the
 * frequency table stays in `../utils` — this file only shapes them for the
 * dispatch board.
 */

import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Badge, Button, EmptyState, Spinner } from '@/components/ui';
import { TASK_TYPE_LABELS, formatDate } from '@/components/domain';
import { parseCoordinates } from '@/types/domain';
import type { RecurringIgienizare, Task, TaskStatus, TaskType } from '@/types/domain';
import { errorMessage, formatTime, frequencyLabel } from '../utils';
import type { Progress } from '../utils';

const TASK_TYPE_TONES: Record<TaskType, 'info' | 'warning' | 'success'> = {
  PLACEMENT: 'success',
  PICKUP: 'warning',
  SANITIZATION: 'info',
};

export function TaskTypeBadge({ type }: { type: TaskType }) {
  return <Badge tone={TASK_TYPE_TONES[type]}>{TASK_TYPE_LABELS[type]}</Badge>;
}

// ---------------------------------------------------------------------------
// Route progress
// ---------------------------------------------------------------------------

/** Completion bar for a route: done / total with a thin meter. */
export function ProgressMeter({ progress }: { progress: Progress }) {
  if (progress.total === 0) {
    return <span className="text-xs text-ink-subtle">fără sarcini</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-surface-active">
        <span
          className="block h-full rounded-full bg-status-done transition-[width]"
          style={{ width: `${progress.percent}%` }}
        />
      </span>
      <span className="tabular text-xs text-ink-muted">
        {progress.done}/{progress.total}
      </span>
    </span>
  );
}

const STOP_SEGMENT_TONES: Record<TaskStatus, string> = {
  NEW: 'bg-border-strong',
  IN_PROGRESS: 'bg-status-progress',
  COMPLETED: 'bg-status-done',
};

/** Above this a per-stop strip is a row of slivers; the meter says more. */
const MAX_SEGMENTS = 20;

/**
 * One segment per stop, coloured by that stop's status.
 *
 * A percentage says how much of the day is done; this says *where* the driver
 * is in it — three green, one amber, four grey reads as "on stop four" at a
 * glance, which is the question a dispatcher scanning the board is asking.
 */
export function StopProgressStrip({
  tasks,
  progress,
}: {
  tasks: readonly Task[];
  progress: Progress;
}) {
  if (progress.total === 0) {
    return <span className="text-xs text-ink-subtle">fără opriri</span>;
  }
  if (tasks.length === 0 || tasks.length > MAX_SEGMENTS) {
    return <ProgressMeter progress={progress} />;
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        role="img"
        aria-label={`${progress.done} din ${progress.total} opriri finalizate`}
        className="flex min-w-0 flex-1 items-center gap-0.5"
      >
        {tasks.map((task) => (
          <span
            key={task.id}
            className={`h-1.5 min-w-0 flex-1 rounded-full ${STOP_SEGMENT_TONES[task.status]}`}
          />
        ))}
      </span>
      <span className="tabular shrink-0 text-xs text-ink-muted">
        {progress.done}/{progress.total}
      </span>
    </span>
  );
}

/** "08:00–14:30" across a route's scheduled stops, or null when none carry one. */
export function timeSpan(tasks: readonly Task[]): string | null {
  const stamps = tasks
    .map((task) => task.scheduledTime)
    .filter((value): value is string => Boolean(value))
    .sort();
  const first = stamps[0];
  const last = stamps[stamps.length - 1];
  if (!first || !last) return null;
  return first === last ? formatTime(first) : `${formatTime(first)}–${formatTime(last)}`;
}

// ---------------------------------------------------------------------------
// Recurring cadence
// ---------------------------------------------------------------------------

/**
 * The day the next task is due: one interval after the last generation, or the
 * plan's own start date while nothing has been generated yet. Null once the
 * plan is retired or has run past its end date — there is no next one to name.
 */
export function nextOccurrenceIso(plan: RecurringIgienizare): string | null {
  if (!plan.active) return null;

  let next = plan.startDate;
  if (plan.lastGeneratedDate) {
    const from = new Date(`${plan.lastGeneratedDate}T00:00:00`);
    if (Number.isNaN(from.getTime())) return null;
    from.setDate(from.getDate() + plan.frequencyDays);
    next = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(
      from.getDate(),
    ).padStart(2, '0')}`;
  }

  if (!next) return null;
  if (!plan.isIndefinite && plan.endDate && next > plan.endDate) return null;
  return next;
}

/**
 * Sentence-cased cadence, e.g. "la fiecare 3 luni".
 *
 * Built on `frequencyLabel` so the frequency table stays in one place; only
 * month-scale intervals are phrased here, because "La 90 zile" is arithmetic
 * the reader should not have to do.
 */
export function cadencePhrase(days: number): string {
  if (days > 30 && days % 30 === 0) return `la fiecare ${days / 30} luni`;
  const label = frequencyLabel(days);
  return label.charAt(0).toLocaleLowerCase('ro-RO') + label.slice(1);
}

/** "la fiecare 3 luni · următoarea 14 mar. 2026" — the plan in one line. */
export function cadenceSummary(plan: RecurringIgienizare): string {
  const next = nextOccurrenceIso(plan);
  const tail = next
    ? `următoarea ${formatDate(next)}`
    : plan.active
      ? 'fără o generare următoare'
      : 'oprit';
  return `${cadencePhrase(plan.frequencyDays)} · ${tail}`;
}

// ---------------------------------------------------------------------------
// Location & detail rows
// ---------------------------------------------------------------------------

/**
 * Address plus raw coordinates.
 *
 * TODO(map): the mobile app opened a native map pin here. A future map pane
 * should render `parseCoordinates(coordinates)` on a real map — deliberately
 * no map library is pulled in for now, so the coordinates are shown as text.
 */
export function LocationBlock({
  address,
  coordinates,
  className,
}: {
  address: string | null;
  coordinates: string | null;
  className?: string;
}) {
  const point = parseCoordinates(coordinates);
  return (
    <div className={className}>
      <p className="text-sm text-ink">{address?.trim() ? address : 'Fără adresă'}</p>
      {point ? (
        <p className="tabular mt-0.5 text-xs text-ink-subtle">
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </p>
      ) : (
        <p className="mt-0.5 text-xs text-ink-subtle">fără coordonate</p>
      )}
    </div>
  );
}

/** One-line address cell for dense tables. */
export function AddressCell({ address }: { address: string | null }) {
  return (
    <span className="block max-w-[22rem] truncate" title={address ?? undefined}>
      {address?.trim() ? address : '—'}
    </span>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-border py-1.5 last:border-0 sm:grid-cols-[8.5rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="mt-1">{children}</dl>;
}

/** Section heading inside a reading pane or drawer. */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pane chrome
// ---------------------------------------------------------------------------

/**
 * Filter strip under a screen's ribbon.
 *
 * Distinct from the layout module's `CommandBar`, which carries the title and
 * the actions: this is the row of pickers a dispatch screen puts *below* it —
 * a date range, a driver, a status. Scrolls horizontally rather than wrapping,
 * so a narrow window keeps the list below the fold rather than the filters.
 */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="scroll-fade-x flex shrink-0 items-end gap-3 overflow-x-auto border-b border-border bg-surface px-3 py-2.5 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

/**
 * Header of a board column. Deliberately not the layout module's `CommandBar`:
 * that one is the page ribbon and there is exactly one per screen, while the
 * dispatch board has three columns that each need their own quiet caption.
 */
export function PanelHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border bg-surface-header px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async states
// ---------------------------------------------------------------------------

export function LoadingBlock({ label = 'Se încarcă…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-ink-muted">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({
  error,
  onRetry,
  title = 'Nu s-au putut încărca datele',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <EmptyState
      title={title}
      icon={<CircleAlert />}
      body={<span className="text-danger-700">{errorMessage(error)}</span>}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Reîncearcă
          </Button>
        ) : undefined
      }
    />
  );
}

/**
 * Loading / error / empty for a non-table pane. Tables get the same treatment
 * from DataTable's own `loading` and `empty` props.
 */
export function AsyncPanel({
  isPending,
  error,
  isEmpty,
  emptyTitle,
  emptyBody,
  emptyIcon,
  onRetry,
  loadingLabel,
  children,
}: {
  isPending: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyBody?: ReactNode;
  emptyIcon?: ReactNode;
  onRetry?: () => void;
  loadingLabel?: string;
  children: ReactNode;
}) {
  if (isPending) return <LoadingBlock label={loadingLabel} />;
  if (error) return <ErrorBlock error={error} onRetry={onRetry} />;
  if (isEmpty) {
    return (
      <EmptyState size="sm" icon={emptyIcon} title={emptyTitle ?? 'Nimic de afișat'} body={emptyBody} />
    );
  }
  return <>{children}</>;
}
