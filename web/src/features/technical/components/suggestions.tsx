/**
 * The dispatch board's stop-order proposal, rendered above the selected
 * route's stop list.
 *
 * It comes from `../grouping.ts` — straight-line geometry over the coordinates
 * the tasks already carry, nothing more. It is shown with its own numbers (km
 * saved, current vs. proposed) so the dispatcher can disagree on sight, and it
 * writes nothing until "Reordonează" is pressed.
 *
 * There was a second card here, "Grupare sugerată" — unassigned jobs proposed
 * for the route. Removed with `suggestRouteGroup` (TODO-16): recommended
 * additions to routes are not wanted. Adding work to a route is a drag from
 * the "Neasignate" queue, and nothing else.
 *
 * Dismissals are keyed by route id, so ignoring a proposal on one route does
 * not silence it on the next, and a dismissed proposal comes back if the board
 * changes enough to produce a different one.
 */

import { useMemo, useState } from 'react';
import { SuggestionCard } from '@/components/ui';
import type { Route, Task } from '@/types/domain';
import { suggestStopOrder } from '../grouping';

export interface DispatchSuggestionsProps {
  route: Route;
  /** The route's stops, already in execution order. */
  routeTasks: Task[];
  busy: boolean;
  onApplyOrder: (orderedIds: number[]) => void;
}

export function DispatchSuggestions({
  route,
  routeTasks,
  busy,
  onApplyOrder,
}: DispatchSuggestionsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const reorder = useMemo(() => suggestStopOrder(routeTasks), [routeTasks]);

  // Re-propose when the shape of the answer changes, even after a dismissal.
  const reorderKey = reorder ? `${route.id}:order:${reorder.orderedIds.join(',')}` : '';

  if (reorder === null || dismissed.has(reorderKey)) return null;

  const dismiss = (key: string) => setDismissed((current) => new Set(current).add(key));

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-surface px-2 py-2">
      <SuggestionCard
        title="Ordine mai scurtă a opririlor"
        layout="stacked"
        details={[reorder.summary]}
        basis="Primul stop rămâne pe loc; restul sunt reordonate după cel mai apropiat următor. Estimare în linie dreaptă — verificați traseul real."
        applyLabel="Reordonează"
        busy={busy}
        onApply={() => onApplyOrder(reorder.orderedIds)}
        onDismiss={() => dismiss(reorderKey)}
      />
    </div>
  );
}
