/**
 * Everything due on one day.
 *
 * Rendered as the calendar's reading pane on `lg+`, inside `ListDetail`'s
 * Sheet below it, and as a standalone slide-over for any caller with neither —
 * the same arrangement Comenzi uses for a single order, and the same reason:
 * one body, several frames, no second copy of the list to drift.
 *
 * The panel is a *reader*, not an editor: picking an order hands over to
 * Comenzi through the existing `?comanda=<id>` deep link, which opens that
 * order's detail with its edit and delete actions already wired. A second
 * place to edit an order is a second place for the two to disagree.
 *
 * Task status is fetched here rather than in the page: the query fans out one
 * `GET /tasks/order/{id}/exists` per order (there is no batch endpoint), so it
 * should cover the ~5 orders of the opened day, not the ~120 of the month.
 */

import { ChevronRight } from 'lucide-react';
import { Badge, Button, Drawer, Skeleton, cx } from '@/components/ui';
import { ClientCell, OrderTypeBadge, TaskStatusBadge, orderCountLabel } from '@/components/domain';
import type { Order } from '@/types/domain';
import { dayLabel } from '../calendar';
import { orderAddress, orderDateLabel, orderSummary } from '../orderModel';
import { useOrderTaskStatuses } from '../queries';

export interface DayOrdersProps {
  iso: string;
  orders: Order[];
  onOpenOrder: (orderId: number) => void;
}

/** The day's orders as a list of cards. Shared by the pane and the drawer. */
export function DayOrdersBody({ orders, onOpenOrder }: Omit<DayOrdersProps, 'iso'>) {
  const statusesQuery = useOrderTaskStatuses(orders.map((order) => order.id));

  return (
    <ul className="flex flex-col gap-2">
      {orders.map((order) => {
        const status = statusesQuery.data?.[order.id] ?? null;
        return (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => onOpenOrder(order.id)}
              className={cx(
                'w-full cursor-pointer rounded-md border border-border bg-surface p-3 text-left transition-colors',
                'hover:border-border-strong hover:bg-surface-hover',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="tabular shrink-0 text-sm font-semibold text-ink">
                    #{order.number}
                  </span>
                  <OrderTypeBadge type={order.orderType} />
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {status ? (
                    <TaskStatusBadge status={status} />
                  ) : statusesQuery.isLoading ? (
                    <Skeleton className="h-4 w-20 rounded-full" />
                  ) : (
                    // No task means nobody has been sent to do this yet — the
                    // one thing on this panel that needs someone to act.
                    <Badge tone="danger">Neprogramat</Badge>
                  )}
                  <ChevronRight aria-hidden className="size-4 text-ink-subtle" />
                </span>
              </span>

              <span className="mt-1.5 flex min-w-0 flex-col gap-0.5 text-sm">
                <ClientCell client={order.client} />
                <span className="truncate text-ink-muted">{orderSummary(order)}</span>
                <span className="truncate text-xs text-ink-subtle">
                  {orderAddress(order) ?? 'Fără adresă'}
                </span>
                {/* Spells out an Amplasare's whole window; the tile could
                    only show the day it starts. */}
                <span className="text-xs text-ink-subtle">{orderDateLabel(order)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The calendar's reading pane. */
export function DayOrdersPane({ iso, orders, onOpenOrder }: DayOrdersProps) {
  return (
    <div role="region" aria-label={dayLabel(iso)} className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <p className="text-base font-semibold text-ink">{dayLabel(iso)}</p>
        <p className="text-xs text-ink-muted">{orderCountLabel(orders.length)}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <DayOrdersBody orders={orders} onOpenOrder={onOpenOrder} />
        <p className="mt-4 text-xs text-ink-subtle">
          Deschide o comandă pentru detalii, editare sau ștergere.
        </p>
      </div>
    </div>
  );
}

/** Standalone slide-over, for a caller with no reading pane to render into. */
export function DayOrdersDrawer({
  iso,
  orders,
  onClose,
  onOpenOrder,
}: DayOrdersProps & { onClose: () => void }) {
  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate">{dayLabel(iso)}</span>
          <span className="shrink-0 text-xs font-normal text-ink-subtle">
            {orderCountLabel(orders.length)}
          </span>
        </span>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Închide
        </Button>
      }
    >
      <DayOrdersBody orders={orders} onOpenOrder={onOpenOrder} />
      <p className="mt-4 text-xs text-ink-subtle">
        Deschide o comandă pentru detalii, editare sau ștergere.
      </p>
    </Drawer>
  );
}
