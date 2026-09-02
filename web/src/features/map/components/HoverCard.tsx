/**
 * Floating hover card, positioned in screen pixels from `map.project()`.
 * A MapLibre `Popup` would fight us here — it wants its own DOM lifecycle
 * and default chrome, and re-creating it every hover is exactly the kind of
 * layer churn the performance section rules out. A plain absolutely
 * positioned element that MapCanvas repositions on every `mousemove` is
 * cheaper and lets it be built from the UI kit like the rest of the app.
 */

import { Badge } from '@/components/ui';
import { formatDate, ORDER_TYPE_LABELS } from '@/components/domain';
import { LIFECYCLE_COLOR, LIFECYCLE_LABEL } from '../types';
import type { PointProperties } from './geo';

export interface HoverCardProps {
  point: PointProperties;
  /** Screen-space pixel position within the map container. */
  x: number;
  y: number;
}

export function HoverCard({ point, x, y }: HoverCardProps) {
  return (
    <div
      className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-[calc(100%+14px)] animate-fade-in rounded-lg border border-border bg-surface p-3 shadow-popover"
      style={{ left: x, top: y }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-semibold text-ink">{point.clientName}</p>
        <span className="tabular shrink-0 text-xs text-ink-subtle">#{point.orderNumber}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Badge>{ORDER_TYPE_LABELS[point.orderType]}</Badge>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
          style={{ backgroundColor: LIFECYCLE_COLOR[point.lifecycle] }}
        >
          {LIFECYCLE_LABEL[point.lifecycle]}
        </span>
      </div>

      <dl className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
        {point.address && (
          <div className="flex items-baseline gap-1.5">
            <dt className="shrink-0">Adresă:</dt>
            <dd className="truncate text-ink">{point.address}</dd>
          </div>
        )}
        <div className="flex items-baseline gap-1.5">
          <dt className="shrink-0">Dată:</dt>
          <dd className="text-ink">{formatDate(point.date)}</dd>
        </div>
        {point.quantity !== null && (
          <div className="flex items-baseline gap-1.5">
            <dt className="shrink-0">Cantitate:</dt>
            <dd className="text-ink">{point.quantity} buc</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
