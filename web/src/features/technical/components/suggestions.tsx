/**
 * The dispatch board's two suggestions, rendered above the selected route's
 * stop list.
 *
 * Both come from `../grouping.ts` — straight-line geometry over the
 * coordinates the tasks already carry, nothing more. They are shown with their
 * own numbers (km, count, why each task qualified) so the dispatcher can
 * disagree on sight, and neither writes anything until "Aplică" is pressed.
 *
 * Dismissals are keyed by route id, so ignoring a proposal on one route does
 * not silence it on the next, and a dismissed proposal comes back if the board
 * changes enough to produce a different one.
 */

import { useMemo, useState } from 'react';
import { Button, SuggestionCard } from '@/components/ui';
import { TASK_TYPE_LABELS } from '@/components/domain';
import type { Route, Task } from '@/types/domain';
import { suggestRouteGroup, suggestStopOrder } from '../grouping';

export interface DispatchSuggestionsProps {
  route: Route;
  /** The route's stops, already in execution order. */
  routeTasks: Task[];
  /** The unassigned queue as currently filtered on screen. */
  pool: Task[];
  busy: boolean;
  onApplyGroup: (taskIds: number[], orderedIds: number[]) => void;
  onApplyOrder: (orderedIds: number[]) => void;
}

export function DispatchSuggestions({
  route,
  routeTasks,
  pool,
  busy,
  onApplyGroup,
  onApplyOrder,
}: DispatchSuggestionsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const group = useMemo(
    () => suggestRouteGroup(route, routeTasks, pool),
    [route, routeTasks, pool],
  );
  const reorder = useMemo(() => suggestStopOrder(routeTasks), [routeTasks]);

  // Re-propose when the shape of the answer changes, even after a dismissal.
  const groupKey = group ? `${route.id}:group:${group.orderedIds.join(',')}` : '';
  const reorderKey = reorder ? `${route.id}:order:${reorder.orderedIds.join(',')}` : '';

  const showGroup = group !== null && !dismissed.has(groupKey);
  const showReorder = reorder !== null && !dismissed.has(reorderKey);
  if (!showGroup && !showReorder) return null;

  const dismiss = (key: string) => setDismissed((current) => new Set(current).add(key));

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-white px-2 py-2">
      {showGroup && group && (
        <SuggestionCard
          title="Grupare sugerată pentru această rută"
          layout="stacked"
          basis={`Sarcini neasignate din aceeași zonă și, unde e programată, din aceeași zi. Distanțele sunt în linie dreaptă, nu pe drum.`}
          applyLabel={`Adaugă ${group.candidates.length}`}
          busy={busy}
          onApply={() =>
            onApplyGroup(
              group.candidates.map((candidate) => candidate.task.id),
              group.orderedIds,
            )
          }
          onDismiss={() => dismiss(groupKey)}
        >
          <p className="mt-1 text-xs text-ink-muted">{group.summary}</p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {(expanded ? group.candidates : group.candidates.slice(0, 3)).map((candidate) => (
              <li key={candidate.task.id} className="truncate text-xs text-ink-muted">
                ·{' '}
                <span className="text-ink">
                  {candidate.task.clientName ?? `Sarcina #${candidate.task.id}`}
                </span>{' '}
                <span className="text-ink-subtle">
                  {TASK_TYPE_LABELS[candidate.task.type]} — {candidate.reason}
                </span>
              </li>
            ))}
          </ul>
          {group.candidates.length > 3 && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded((open) => !open)}>
              {expanded ? 'Arată mai puțin' : `Încă ${group.candidates.length - 3}`}
            </Button>
          )}
        </SuggestionCard>
      )}

      {showReorder && reorder && (
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
      )}
    </div>
  );
}
