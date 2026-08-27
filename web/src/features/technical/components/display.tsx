/**
 * Small presentational pieces shared across the four Technical screens.
 *
 * Nothing here fetches. Enum labels come from `@/components/domain`.
 */

import type { ReactNode } from 'react';
import { Badge, Button, EmptyState, Spinner } from '@/components/ui';
import { TASK_TYPE_LABELS } from '@/components/domain';
import { parseCoordinates } from '@/types/domain';
import type { TaskType } from '@/types/domain';
import { errorMessage } from '../utils';
import type { Progress } from '../utils';

const TASK_TYPE_TONES: Record<TaskType, 'info' | 'warning' | 'success'> = {
  PLACEMENT: 'success',
  PICKUP: 'warning',
  SANITIZATION: 'info',
};

export function TaskTypeBadge({ type }: { type: TaskType }) {
  return <Badge tone={TASK_TYPE_TONES[type]}>{TASK_TYPE_LABELS[type]}</Badge>;
}

/** Completion bar for a route: done / total with a thin meter. */
export function ProgressMeter({ progress }: { progress: Progress }) {
  if (progress.total === 0) {
    return <span className="text-xs text-ink-subtle">fără sarcini</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-surface-sunken">
        <span
          className="block h-full rounded-full bg-green-600 transition-[width]"
          style={{ width: `${progress.percent}%` }}
        />
      </span>
      <span className="tabular text-xs text-ink-muted">
        {progress.done}/{progress.total}
      </span>
    </span>
  );
}

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
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-border/60 py-2 last:border-0">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="mt-1">{children}</dl>;
}

/** Sticky filter strip under a PageHeader. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border bg-white px-5 py-2.5">
      {children}
    </div>
  );
}

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
    <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-sunken px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

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
      body={<span className="text-red-700">{errorMessage(error)}</span>}
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
  onRetry,
  loadingLabel,
  children,
}: {
  isPending: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyBody?: ReactNode;
  onRetry?: () => void;
  loadingLabel?: string;
  children: ReactNode;
}) {
  if (isPending) return <LoadingBlock label={loadingLabel} />;
  if (error) return <ErrorBlock error={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle ?? 'Nimic de afișat'} body={emptyBody} />;
  return <>{children}</>;
}
