/**
 * Why a subscription cannot be retired yet, with the blockers named — and the
 * one bulk action that clears them.
 *
 * A toast saying "3 orders still use this" is not actionable — the operator's
 * next question is always *which* three. Every order here links through to
 * Comenzi (`?comanda=<id>`), so the refusal comes with the way to resolve it.
 *
 * It also offers *Mută pe alt abonament* (TODO-37). That is not a contradiction
 * of the note this file used to carry: what was refused was a bulk write
 * triggered by pressing DELETE, which the operator asked for only obliquely.
 * This is the same write asked for explicitly, by its own button, on a list they
 * have just read — and it moves exactly the orders shown, nothing else.
 *
 * Recurring plans deliberately have no such button. They are stopped from a
 * Tehnic screen, and moving one would keep it generating orders against a plan
 * the operator is trying to retire.
 *
 * Local state (the chosen target) lives here and resets by NOT BEING MOUNTED —
 * the caller renders this only while a delete stands refused, per the house rule
 * from TODO-26.
 */

import { useState } from 'react';
import { Badge, Button, Modal, Select } from '@/components/ui';
import { formatDate } from '@/components/domain';
import type { SubscriptionUsage } from '@/api';
import type { Subscription } from '@/types/domain';

export interface SubscriptionUsageModalProps {
  subscription: Subscription;
  usage: SubscriptionUsage;
  /** Active plans this one's orders could move to — never includes itself. */
  moveTargets: Subscription[];
  onClose: () => void;
  onOpenOrder: (orderId: number) => void;
  onMoveOrders: (targetSubscriptionId: number, orderIds: number[]) => void;
  moving: boolean;
}

export function SubscriptionUsageModal({
  subscription,
  usage,
  moveTargets,
  onClose,
  onOpenOrder,
  onMoveOrders,
  moving,
}: SubscriptionUsageModalProps) {
  const { orders, recurringPlans } = usage;
  const [targetId, setTargetId] = useState<number | null>(null);

  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={`Abonamentul „${subscription.name}” nu poate fi șters`}
      footer={
        <Button variant="secondary" onClick={onClose} disabled={moving}>
          Am înțeles
        </Button>
      }
    >
      <p className="text-sm text-ink-muted">
        Abonamentul este încă folosit. Finalizați sau ștergeți elementele de mai jos, ori mutați-le
        pe alt abonament, apoi încercați din nou.
      </p>

      {orders.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
            Comenzi nefinalizate ({orders.length})
          </h3>
          <ul className="flex flex-col gap-1.5">
            {orders.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onOpenOrder(order.id)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-left transition hover:border-accent-300 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="tabular shrink-0 font-semibold text-ink">#{order.number}</span>
                    <span className="truncate text-ink-muted">{order.clientName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-subtle">
                    {formatDate(order.sanitationDate)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {orders.length > 0 && (
        <section className="mt-4 rounded-md border border-border bg-surface-sunken p-3">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
            Mută pe alt abonament
          </h3>
          {moveTargets.length === 0 ? (
            <p className="text-xs text-ink-subtle">
              Nu există alt abonament activ pe care să fie mutate. Creați unul întâi.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-56 flex-1">
                  <Select<number>
                    label="Abonamentul destinație"
                    value={targetId}
                    options={moveTargets.map((plan) => ({ value: plan.id, label: plan.name }))}
                    onChange={setTargetId}
                    placeholder="Alege abonamentul"
                    searchable
                    disabled={moving}
                  />
                </div>
                <Button
                  onClick={() =>
                    targetId !== null &&
                    onMoveOrders(
                      targetId,
                      orders.map((order) => order.id),
                    )
                  }
                  disabled={targetId === null || moving}
                >
                  {moving
                    ? 'Se mută…'
                    : orders.length === 1
                      ? 'Mută 1 comandă'
                      : `Mută ${orders.length} comenzi`}
                </Button>
              </div>
              <p className="mt-2 text-xs text-ink-subtle">
                {recurringPlans.length > 0
                  ? 'Comenzile de mai sus vor fi mutate, dar abonamentul tot nu va putea fi șters până când planurile recurente de mai jos nu sunt oprite.'
                  : 'Comenzile de mai sus vor fi mutate, apoi abonamentul va fi șters.'}
              </p>
            </>
          )}
        </section>
      )}

      {recurringPlans.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
            Planuri recurente active ({recurringPlans.length})
          </h3>
          {/* Not links: Igienizări recurente is a Tehnic screen, and a
              Vânzări-only account would land on "acces interzis". */}
          <ul className="flex flex-col gap-1.5">
            {recurringPlans.map((plan) => (
              <li
                key={plan.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm"
              >
                <span className="truncate text-ink">{plan.clientName}</span>
                <span className="shrink-0 text-xs text-ink-subtle">
                  {plan.frequencyDays === null ? '—' : `la ${plan.frequencyDays} zile`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-subtle">
            Un plan activ generează comenzi noi în fiecare noapte, așa că blochează ștergerea chiar
            dacă nu există comenzi nefinalizate. Planurile se opresc din secțiunea{' '}
            <Badge tone="neutral">Igienizări recurente</Badge>.
          </p>
        </section>
      )}
    </Modal>
  );
}
