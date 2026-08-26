/**
 * "Add a recurring sanitation plan to this route" — the desktop equivalent of
 * the mobile UnassignedRecurring screen, reachable from the dispatch board.
 *
 * Assigning a plan makes the backend generate its tasks on the target route,
 * which is why the caller's route task list is invalidated by the mutation.
 *
 * Keyboard-first, on the same pattern as `pickers.tsx` and sharing its
 * `useListKeyboard` / `PickerRow`: the filter takes focus on open, ↑ ↓ move a
 * highlight, Enter assigns. A dispatcher filling a route works through several
 * of these in a row, and reaching for the mouse between each one is the whole
 * cost of the screen. The list is a real `listbox` driven by
 * `aria-activedescendant`, so the highlighted plan is announced without focus
 * leaving the filter box.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, TextInput } from '@/components/ui';
import { formatDate } from '@/components/domain';
import { boost, recordUse } from '@/lib/recents';
import { clientName } from '@/types/domain';
import type { RecurringIgienizare, Route } from '@/types/domain';
import { useAssignRecurringRoute, useRecurring } from '../queries';
import { errorMessage, frequencyLabel, matchesQuery, routeLabel } from '../utils';
import { AsyncPanel } from './display';
import { PickerRow, useListKeyboard } from './pickers';
import { useFeedback } from './feedback';

export interface AssignRecurringModalProps {
  open: boolean;
  onClose: () => void;
  route: Route | null;
}

const LIST_ID = 'assign-recurring-list';

function planMeta(plan: RecurringIgienizare): string {
  return [
    frequencyLabel(plan.frequencyDays),
    `început ${formatDate(plan.startDate)}`,
    plan.isIndefinite ? 'nedeterminat' : `sfârșit ${formatDate(plan.endDate)}`,
    plan.sanitationLocationAddress ?? 'fără adresă',
  ].join(' · ');
}

export function AssignRecurringModal({ open, onClose, route }: AssignRecurringModalProps) {
  const { toast } = useFeedback();
  const plansQuery = useRecurring('unassigned');
  const assign = useAssignRecurringRoute();

  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const list = (plansQuery.data ?? []).filter((plan) =>
      matchesQuery(
        query,
        clientName(plan.client),
        plan.sanitationLocationAddress,
        plan.contact,
        plan.subscription?.name,
      ),
    );
    if (query.trim()) return list;
    // Empty filter: plans for clients this operator has been working on first.
    return [...list].sort(
      (left, right) =>
        boost('recurring', right.id) - boost('recurring', left.id) ||
        (left.startDate ?? '').localeCompare(right.startDate ?? ''),
    );
  }, [plansQuery.data, query]);

  const pick = (plan: RecurringIgienizare) => {
    if (!route || assign.isPending) return;
    recordUse('recurring', plan.id);
    assign.mutate(
      { planId: plan.id, routeId: route.id },
      {
        onSuccess: () =>
          toast.success(
            `Planul pentru ${clientName(plan.client)} a fost asignat pe ${routeLabel(route)}.`,
          ),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  const { highlight, setHighlight, listRef, onKeyDown } = useListKeyboard(filtered, pick);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Igienizări recurente neasignate"
      width="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Închide
        </Button>
      }
    >
      <p className="mb-3 text-sm text-ink-muted">
        Alege un plan pentru a-l asigna pe <strong>{routeLabel(route)}</strong>. Sarcinile se
        generează automat la asignare.
      </p>

      <TextInput
        data-autofocus
        placeholder="Caută client, adresă sau abonament…  (↑↓ și Enter)"
        aria-label="Caută plan recurent"
        role="combobox"
        aria-expanded
        aria-controls={LIST_ID}
        aria-autocomplete="list"
        aria-activedescendant={filtered[highlight] ? `${LIST_ID}-${highlight}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
      />

      <div ref={listRef} className="mt-3 max-h-80 overflow-y-auto">
        <AsyncPanel
          isPending={plansQuery.isPending}
          error={plansQuery.error}
          isEmpty={filtered.length === 0}
          emptyTitle={
            query.trim() ? 'Niciun plan pentru această căutare' : 'Nicio igienizare recurentă neasignată'
          }
          emptyBody={
            query.trim()
              ? 'Încearcă alt termen de căutare.'
              : 'Toate planurile active au deja o rută.'
          }
          onRetry={() => void plansQuery.refetch()}
        >
          <div
            id={LIST_ID}
            role="listbox"
            aria-label="Planuri recurente neasignate"
            className="flex flex-col gap-1.5"
          >
            {filtered.map((plan, index) => (
              <PickerRow
                key={plan.id}
                id={`${LIST_ID}-${index}`}
                index={index}
                title={clientName(plan.client)}
                meta={planMeta(plan)}
                disabled={!route || assign.isPending}
                active={index === highlight}
                onHover={() => setHighlight(index)}
                onSelect={() => pick(plan)}
                trailing={
                  <Button
                    size="sm"
                    variant="primary"
                    // Not focusable: it lives inside a role="option" and only
                    // repeats the row's own action. See PickerRow#trailing.
                    tabIndex={-1}
                    disabled={!route || assign.isPending}
                    loading={assign.isPending && assign.variables?.planId === plan.id}
                    onClick={() => pick(plan)}
                  >
                    Asignează
                  </Button>
                }
              />
            ))}
          </div>
        </AsyncPanel>
      </div>
    </Modal>
  );
}
