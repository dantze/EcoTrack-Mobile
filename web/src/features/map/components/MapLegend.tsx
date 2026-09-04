/**
 * Reads the canvas, not the filters — the sidebar (`MapPage`) already lets a
 * dispatcher toggle order types and lifecycles; this just explains what the
 * dots, ring and lines on screen currently mean, which changes with `colorBy`,
 * `showHeatmap` and `showRoutes` independently of any filter.
 *
 * **It collapses to a button below `sm` (TODO-58).** The panel is up to 224px
 * wide and six rows tall; on a 390px phone it covered roughly a fifth of the
 * map, permanently, in the corner where the pins for the southern half of the
 * country are. A legend is a reference, not a control — it is read once and
 * then ignored — so on a small screen it earns a tap rather than the space.
 *
 * The content is written once and rendered in both places. Two copies of a
 * colour list is exactly the kind of thing that drifts when a lifecycle is
 * added, and the drift would be invisible until someone opened the phone view.
 */

import { useState } from 'react';
import { List } from 'lucide-react';
import { Button } from '@/components/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/popover';
import { ORDER_TYPE_LABELS } from '@/components/domain';
import { ORDER_TYPES, type OrderTypeTag } from '@/types/domain';
import {
  LIFECYCLE_COLOR,
  LIFECYCLES,
  LIFECYCLE_LABEL,
  ORDER_TYPE_COLOR,
  type Lifecycle,
} from '../types';

export interface MapLegendProps {
  colorBy: 'orderType' | 'lifecycle';
  showHeatmap: boolean;
  showRoutes: boolean;
  hasRoutes: boolean;
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function LegendBody({ colorBy, showHeatmap, showRoutes, hasRoutes }: MapLegendProps) {
  const entries: { key: string; label: string; color: string }[] =
    colorBy === 'orderType'
      ? ORDER_TYPES.map((type: OrderTypeTag) => ({
          key: type,
          label: ORDER_TYPE_LABELS[type],
          color: ORDER_TYPE_COLOR[type],
        }))
      : LIFECYCLES.map((life: Lifecycle) => ({
          key: life,
          label: LIFECYCLE_LABEL[life],
          color: LIFECYCLE_COLOR[life],
        }));

  return (
    <div className="flex flex-col gap-2 text-xs">
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

export function MapLegend(props: MapLegendProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Phone: a trigger in the corner the panel used to occupy. */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-3 left-3 shadow-popover sm:hidden"
          >
            <List />
            Legendă
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-56 p-3"
          // The map swallows pointer events it does not recognise; without this
          // the popover closes on the same tap that opened it.
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <LegendBody {...props} />
        </PopoverContent>
      </Popover>

      {/* Tablet and up: the panel itself, unchanged. */}
      <div className="absolute bottom-3 left-3 hidden max-w-56 rounded-lg bg-surface/95 p-3 shadow-popover ring-1 ring-border ring-inset backdrop-blur-sm sm:block">
        <LegendBody {...props} />
      </div>
    </>
  );
}
