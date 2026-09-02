/**
 * The shared half of the two "why can't I delete this?" dialogs (TODO-57).
 *
 * Abonamente and Produse now refuse a delete by the SAME rule — a soft delete,
 * blocked by orders whose work is not finished — so the two refusals have to be
 * equally answerable: name the blockers, and get the operator to them. A dialog
 * that only says "still in use" leaves them hunting through Comenzi by hand.
 *
 * What lives here is exactly what both dialogs share: the shell, and the list of
 * blocking orders. What does NOT live here is what only one of them has —
 * Abonamente's bulk move (TODO-37) and its active recurring plans, both of which
 * are subscription-shaped facts. Parameterising those in would make this
 * component a switch over which caller it has, which is the thing worth avoiding
 * more than the duplication.
 *
 * There is deliberately no product equivalent of the bulk move: moving an order
 * to a different product changes what is physically delivered, which is a real
 * decision per order, not a bulk one.
 */

import type { ReactNode } from 'react';
import { Button, Modal } from '@/components/ui';

export interface UsageModalProps {
  /** Full Romanian sentence, e.g. `Produsul „X” nu poate fi șters`. */
  title: string;
  /** One line under the title saying what would resolve the refusal. */
  intro: string;
  /** Sections: the blocking lists, and anything only one caller has. */
  children: ReactNode;
  onClose: () => void;
  /** True while a bulk action is running — the shell must not close under it. */
  busy?: boolean;
}

export function UsageModal({ title, intro, children, onClose, busy = false }: UsageModalProps) {
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={title}
      footer={
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Am înțeles
        </Button>
      }
    >
      <p className="text-sm text-ink-muted">{intro}</p>
      {children}
    </Modal>
  );
}

/** One row of the list: enough to recognise the order, and its id to open it. */
export interface BlockingOrderRow {
  id: number;
  number: number;
  clientName: string;
  /** Right-hand column — a date, or a type plus a date. Already formatted. */
  meta: string;
}

export interface BlockingOrderListProps {
  heading: string;
  orders: BlockingOrderRow[];
  /** Deep-links into Comenzi. Every row is a link, which is the point. */
  onOpenOrder: (orderId: number) => void;
}

/**
 * The blocking orders, each one a button that navigates to it.
 *
 * Rendering these as links is the whole value of the dialog: the operator's
 * next question after "3 comenzi still use this" is always *which* three.
 */
export function BlockingOrderList({ heading, orders, onOpenOrder }: BlockingOrderListProps) {
  return (
    <section className="mt-4">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        {heading} ({orders.length})
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
              <span className="shrink-0 text-xs text-ink-subtle">{order.meta}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
