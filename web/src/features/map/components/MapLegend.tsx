/**
 * Reads the canvas, not the filters — the sidebar (`MapPage`) already lets a
 * dispatcher toggle order types and lifecycles; this just explains what the
 * dots, ring and lines on screen currently mean, which changes with `colorBy`,
 * `showHeatmap` and `showRoutes` independently of any filter.
 */

import { ORDER_TYPE_LABELS } from '@/components/domain';
import { ORDER_TYPES, type OrderTypeTag } from '@/types/domain';
import { LIFECYCLE_COLOR, LIFECYCLES, LIFECYCLE_LABEL, ORDER_TYPE_COLOR, type Lifecycle } from '../types';

export interface MapLegendProps {
  colorBy: 'orderType' | 'lifecycle';
  showHeatmap: boolean;
  showRoutes: boolean;
  hasRoutes: boolean;
}

function Swatch({ color }: { color: string }) {
  return <span className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} aria-hidden />;
}

export function MapLegend({ colorBy, showHeatmap, showRoutes, hasRoutes }: MapLegendProps) {
  const entries: { key: string; label: string; color: string }[] =
    colorBy === 'orderType'
      ? ORDER_TYPES.map((type: OrderTypeTag) => ({ key: type, label: ORDER_TYPE_LABELS[type], color: ORDER_TYPE_COLOR[type] }))
      : LIFECYCLES.map((life: Lifecycle) => ({ key: life, label: LIFECYCLE_LABEL[life], color: LIFECYCLE_COLOR[life] }));

  return (
    <div className="absolute bottom-3 left-3 flex max-w-56 flex-col gap-2 rounded-lg bg-white/95 p-3 text-xs shadow-popover ring-1 ring-border ring-inset backdrop-blur-sm">
      <ul className="flex flex-col gap-1">
        {entries.map((entry) => (
          <li key={entry.key} className="flex items-center gap-1.5 text-ink-muted">
            <Swatch color={entry.color} />
            <span className="truncate">{entry.label}</span>
          </li>
        ))}
      </ul>

      {(showHeatmap || (showRoutes && hasRoutes)) && (
        <div className="flex flex-col gap-1 border-t border-border pt-2 text-ink-subtle">
          {showHeatmap && <p>Densitate: culoare mai intensă = mai multe unități.</p>}
          {showRoutes && hasRoutes && <p>Traseu: cifra e ordinea opririi, ✓ e finalizată.</p>}
        </div>
      )}
    </div>
  );
}
