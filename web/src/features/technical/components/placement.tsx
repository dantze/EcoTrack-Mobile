/**
 * "Pick up, then place" — the dispatch board's primary way to build a route.
 *
 * Dragging across two scrolling columns is the slowest part of this screen. A
 * dispatcher does not move one job; they look at the pool, recognise four
 * that belong together, and want all four on the route at a particular stop.
 * Doing that by drag means four separate cross-column gestures, each with its
 * own chance to drop on the wrong row, and each needing the target scrolled
 * into view first.
 *
 * So the gesture is split in two. **Click a pool task to pick it up** (click
 * again to put it back) — the held set is visible the whole time in a tray.
 * **Then click where it goes**, and everything held lands there at once, in the
 * order it was picked up. Nothing is held under the pointer, so both columns
 * stay scrollable between the two halves of the gesture, and the target is a
 * full-width labelled band rather than a two-pixel gap.
 *
 * Dragging still works and is unchanged for anyone who prefers it — the same
 * insertion bands are dnd-kit drop targets, so a drag now lands on an explicit
 * position instead of "somewhere near this row".
 *
 * The bands only appear while something is actually in hand. An idle board
 * shows a clean list; a loaded one shows exactly where the payload can go.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cx } from '@/components/ui';
import type { Task } from '@/types/domain';

// ---------------------------------------------------------------------------
// Held-task state
// ---------------------------------------------------------------------------

interface PlacementValue {
  /** Picked up, in pick-up order — that is the order they will be inserted. */
  held: Task[];
  toggle: (task: Task) => void;
  isHeld: (taskId: number) => boolean;
  clear: () => void;
  /** True while anything is in hand, i.e. while insertion bands are live. */
  active: boolean;
}

const PlacementContext = createContext<PlacementValue | null>(null);

export function PlacementProvider({ children }: { children: ReactNode }) {
  const [held, setHeld] = useState<Task[]>([]);

  const toggle = useCallback((task: Task) => {
    setHeld((current) =>
      current.some((entry) => entry.id === task.id)
        ? current.filter((entry) => entry.id !== task.id)
        : [...current, task],
    );
  }, []);

  const clear = useCallback(() => setHeld([]), []);

  const value = useMemo<PlacementValue>(
    () => ({
      held,
      toggle,
      isHeld: (taskId: number) => held.some((entry) => entry.id === taskId),
      clear,
      active: held.length > 0,
    }),
    [held, toggle, clear],
  );

  return <PlacementContext.Provider value={value}>{children}</PlacementContext.Provider>;
}

const NOOP: PlacementValue = {
  held: [],
  toggle: () => {},
  isHeld: () => false,
  clear: () => {},
  active: false,
};

export function usePlacement(): PlacementValue {
  return useContext(PlacementContext) ?? NOOP;
}

// ---------------------------------------------------------------------------
// Insertion band
// ---------------------------------------------------------------------------

export function slotId(index: number): string {
  return `slot-${index}`;
}

/** `slot-3` → 3. Returns null for anything else, so callers can narrow safely. */
export function readSlotIndex(id: unknown): number | null {
  if (typeof id !== 'string' || !id.startsWith('slot-')) return null;
  const parsed = Number.parseInt(id.slice(5), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * The gap between two stops, as a real target.
 *
 * Collapsed to a thin strip when nothing is in hand so the list stays dense,
 * and expanded into a labelled band the moment something is — the label states
 * the stop number the payload will take, which is the one thing the old
 * shifting-rows animation never actually told anyone.
 */
export function InsertionSlot({
  index,
  count,
  onPlace,
  disabled = false,
}: {
  /** Insert position: 0 is before the first stop, `n` is after the last. */
  index: number;
  /** How many tasks would land here — drives the label. */
  count: number;
  onPlace: (index: number) => void;
  disabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(index), disabled });
  const { active } = usePlacement();
  const live = (active || isOver) && !disabled;

  if (!live) {
    // Still a drop target while dragging, just visually out of the way.
    return <div ref={setNodeRef} className="h-1.5" aria-hidden="true" />;
  }

  const label =
    count > 1 ? `Inserează ${count} sarcini ca oprirea ${index + 1}` : `Inserează ca oprirea ${index + 1}`;

  return (
    <div ref={setNodeRef} className="py-0.5">
      <button
        type="button"
        onClick={() => onPlace(index)}
        aria-label={label}
        className={cx(
          'flex w-full items-center gap-2 rounded-md border-2 border-dashed px-2 py-1.5 text-left transition-colors',
          isOver
            ? 'border-primary bg-accent-100'
            : 'border-accent-300 bg-accent-50/60 hover:border-primary hover:bg-accent-100',
        )}
      >
        <span className="tabular inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
          {index + 1}
        </span>
        <span className="truncate text-xs font-medium text-accent-800">{label}</span>
      </button>
    </div>
  );
}

/**
 * Moves the stop at `from` to the insertion band at `toSlot`.
 *
 * The off-by-one here is the whole reason this is a named function with tests.
 * Band indices count positions in the list *as it currently stands*, so once
 * the dragged stop is lifted out, every band after it refers to a position one
 * lower. Dropping stop 0 on band 2 must land it at index 1, not 2 — get this
 * wrong and a stop dragged one place down does not move at all, which reads as
 * a broken drag rather than an arithmetic slip.
 *
 * Returns the original array when the move is a no-op, so callers can skip a
 * pointless write.
 */
export function moveToSlot(ids: readonly number[], from: number, toSlot: number): number[] {
  if (from < 0 || from >= ids.length) return [...ids];
  const target = toSlot > from ? toSlot - 1 : toSlot;
  const clamped = Math.max(0, Math.min(target, ids.length - 1));
  if (clamped === from) return [...ids];

  const next = [...ids];
  next.splice(from, 1);
  next.splice(clamped, 0, ids[from]);
  return next;
}

/** Inserts `incoming` into `ids` at the given band, clamped to the list. */
export function insertAtSlot(
  ids: readonly number[],
  incoming: readonly number[],
  toSlot: number,
): number[] {
  const next = [...ids];
  next.splice(Math.max(0, Math.min(toSlot, next.length)), 0, ...incoming);
  return next;
}

// ---------------------------------------------------------------------------
// Held tray
// ---------------------------------------------------------------------------

/**
 * Persistent readout of what is in hand. Without it the mode is invisible:
 * clicking a card would change a colour somewhere off-screen and the next
 * click would do something surprising.
 */
export function HeldTray({ onCancel }: { onCancel: () => void }) {
  const { held } = usePlacement();
  if (held.length === 0) return null;

  return (
    <div className="border-b border-accent-200 bg-accent-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-accent-800">
          {held.length === 1 ? '1 sarcină în mână' : `${held.length} sarcini în mână`}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Renunță (Esc)
        </button>
      </div>
      <p className="mt-0.5 truncate text-xs text-accent-800">
        {held.map((task) => task.clientName?.trim() || `#${task.id}`).join(' · ')}
      </p>
      <p className="mt-1 text-xs text-primary">
        Alege poziția din lista rutei pentru a le insera.
      </p>
    </div>
  );
}
