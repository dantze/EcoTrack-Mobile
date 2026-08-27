/**
 * Why a subscription cannot be retired yet, with the blockers named.
 *
 * A toast saying "3 orders still use this" is not actionable — the operator's
 * next question is always *which* three. Every order here links through to
 * Comenzi (`?comanda=<id>`), so the refusal comes with the way to resolve it.
 *
 * Read-only by design. Fulfilling, deleting or re-pointing an order happens in
 * the order's own form; this dialog does not offer a bulk "move them all to
 * another plan", because that would be a sweeping write the operator asked for
 * only obliquely by pressing Delete.
 */

import { Badge, Button, Modal } from '@/components/ui';
import { formatDate } from '@/components/domain';
import type { SubscriptionUsage } from '@/api';
import type { Subscription } from '@/types/domain';

export interface SubscriptionUsageModalProps {
  subscription: Subscription;
  usage: SubscriptionUsage;
  onClose: () => void;
  onOpenOrder: (orderId: number) => void;
}

export function SubscriptionUsageModal({
  subscription,
  usage,
  onClose,
  onOpenOrder,
}: SubscriptionUsageModalProps) {
  const { orders, recurringPlans } = usage;

  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={`Abonamentul „${subscription.name}” nu poate fi șters`}
      footer={
        <Button variant="secondary" onClick={onClose}>
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
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2 text-left transition hover:border-brand-300 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
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
