/**
 * Custom zoom / fit-bounds chrome, styled to match the app instead of
 * MapLibre's stock white squares. `IconButton` from the UI kit gives us the
 * focus ring, disabled state and hover treatment for free.
 */

import { IconButton } from '@/components/ui';

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden className="size-4">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden className="size-4">
      <path d="M3 8h10" />
    </svg>
  );
}

/** Corner brackets read as "fit to frame" without borrowing a magnifying-glass metaphor already used for search. */
function FitIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-4">
      <path d="M2 5.5V3a1 1 0 0 1 1-1h2.5M14 5.5V3a1 1 0 0 0-1-1h-2.5M2 10.5V13a1 1 0 0 0 1 1h2.5M14 10.5V13a1 1 0 0 1-1 1h-2.5" />
    </svg>
  );
}

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  fitDisabled: boolean;
}

export function MapControls({ onZoomIn, onZoomOut, onFit, fitDisabled }: MapControlsProps) {
  return (
    <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-lg bg-surface shadow-popover ring-1 ring-border ring-inset">
      <IconButton
        label="Mărește"
        variant="ghost"
        className="rounded-none border-b border-border"
        onClick={onZoomIn}
      >
        <PlusIcon />
      </IconButton>
      <IconButton label="Micșorează" variant="ghost" className="rounded-none border-b border-border" onClick={onZoomOut}>
        <MinusIcon />
      </IconButton>
      <IconButton
        label="Încadrează toate comenzile"
        variant="ghost"
        className="rounded-none"
        onClick={onFit}
        disabled={fitDisabled}
      >
        <FitIcon />
      </IconButton>
    </div>
  );
}
