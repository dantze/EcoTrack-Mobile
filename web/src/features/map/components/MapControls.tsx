/**
 * Floating zoom / fit chrome, styled as the app rather than MapLibre's stock
 * white squares.
 *
 * Three changes from the first version (TODO-58):
 *
 * - It is a real `ButtonGroup` now, not a `<div>` imitating one. The group owns
 *   the shared border and the corner rounding, so the buttons no longer each
 *   carry a hand-written `rounded-none border-b` that has to be re-derived
 *   whenever a button is added or reordered — the last one used to need a
 *   different class from the rest, purely because it was last.
 * - The three hand-drawn `<svg>`s are lucide icons. They were the only
 *   bespoke icons left in the app, and `Maximize` says "fit to frame" more
 *   clearly than the corner brackets did.
 * - It sits above the legend's mobile trigger in the corner ordering, and is
 *   reachable by keyboard in the order it is read.
 *
 * Positioned as a sibling of the MapLibre container rather than inside it —
 * see the comment on that container in `MapCanvas`, which must keep its inline
 * `position: absolute; inset: 0`.
 */

import { Maximize, Minus, Plus } from 'lucide-react';
import { ButtonGroup, IconButton } from '@/components/ui';

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  fitDisabled: boolean;
}

export function MapControls({ onZoomIn, onZoomOut, onFit, fitDisabled }: MapControlsProps) {
  return (
    <ButtonGroup
      orientation="vertical"
      className="absolute top-3 right-3 shadow-popover"
    >
      <IconButton label="Mărește" variant="secondary" onClick={onZoomIn}>
        <Plus />
      </IconButton>
      <IconButton label="Micșorează" variant="secondary" onClick={onZoomOut}>
        <Minus />
      </IconButton>
      <IconButton
        label="Încadrează toate comenzile"
        variant="secondary"
        onClick={onFit}
        disabled={fitDisabled}
      >
        <Maximize />
      </IconButton>
    </ButtonGroup>
  );
}
