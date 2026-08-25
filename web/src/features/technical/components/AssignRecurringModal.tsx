/**
 * "Add a recurring sanitation plan to this route" — the desktop equivalent of
 * the mobile UnassignedRecurring screen, reachable from the dispatch board.
 *
 * Assigning a plan makes the backend generate its tasks on the target route,
 * which is why the caller's route task list is invalidated by the mutation.
 */

import { Button, Modal } from '@/components/ui';
import { formatDate } from '@/components/domain';
import { clientName } from '@/types/domain';
import type { Route } from '@/types/domain';
import { useAssignRecurringRoute, useRecurring } from '../queries';
import { errorMessage, frequencyLabel, routeLabel } from '../utils';
import { AsyncPanel } from './display';
import { useFeedback } from './feedback';

export interface AssignRecurringModalProps {
  open: boolean;
  onClose: () => void;
  route: Route | null;
}

export function AssignRecurringModal({ open, onClose, route }: AssignRecurringModalProps) {
  const { toast } = useFeedback();
  const plansQuery = useRecurring('unassigned');
  const assign = useAssignRecurringRoute();

  const plans = plansQuery.data ?? [];

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

      <div className="max-h-96 overflow-y-auto">
        <AsyncPanel
          isPending={plansQuery.isPending}
          error={plansQuery.error}
          isEmpty={plans.length === 0}
          emptyTitle="Nicio igienizare recurentă neasignată"
          emptyBody="Toate planurile active au deja o rută."
          onRetry={() => void plansQuery.refetch()}
        >
          <div className="flex flex-col gap-1.5">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {clientName(plan.client)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {frequencyLabel(plan.frequencyDays)} · început {formatDate(plan.startDate)}
                    {plan.isIndefinite ? ' · nedeterminat' : ` · sfârșit ${formatDate(plan.endDate)}`}
                  </p>
                  <p
                    className="mt-0.5 truncate text-xs text-ink-subtle"
                    title={plan.sanitationLocationAddress ?? undefined}
                  >
                    {plan.sanitationLocationAddress ?? 'Fără adresă'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!route || assign.isPending}
                  loading={assign.isPending && assign.variables?.planId === plan.id}
                  onClick={() => {
                    if (!route) return;
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
                  }}
                >
                  Asignează
                </Button>
              </div>
            ))}
          </div>
        </AsyncPanel>
      </div>
    </Modal>
  );
}
