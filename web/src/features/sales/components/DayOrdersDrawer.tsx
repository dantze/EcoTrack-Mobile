/**
 * Everything due on one day, in the same slide-over the rest of Sales uses so
 * the calendar stays on screen and keeps its month.
 *
 * The panel is a *reader*, not an editor: picking an order hands over to
 * Comenzi through the existing `?comanda=<id>` deep link, which opens that
 * order's detail drawer with its edit and delete actions already wired. A
 * second place to edit an order is a second place for the two to disagree.
 *
 * Task status is fetched here rather than in the page: the query fans out one
 * `GET /tasks/order/{id}/exists` per order (there is no batch endpoint), so it
 * should cover the ~5 orders of the opened day, not the ~120 of the month.
 */

import { Badge, Button, Drawer, Skeleton } from '@/components/ui';
import {
  ClientCell,
  OrderTypeBadge,
  TaskStatusBadge,
  orderCountLabel,
} from '@/components/domain';
import type { Order } from '@/types/domain';
import { dayLabel } from '../calendar';
import { orderAddress, orderDateLabel, orderSummary } from '../orderModel';
import { useOrderTaskStatuses } from '../queries';

export interface DayOrdersDrawerProps {
  iso: string;
  orders: Order[];
  onClose: () => void;
  onOpenOrder: (orderId: number) => void;
}

export function DayOrdersDrawer({ iso, orders, onClose, onOpenOrder }: DayOrdersDrawerProps) {
  const statusesQuery = useOrderTaskStatuses(orders.map((order) => order.id));

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
      <ul className="flex flex-col gap-2">
        {orders.map((order) => {
          const status = statusesQuery.data?.[order.id] ?? null;
          return (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => onOpenOrder(order.id)}
                className="w-full cursor-pointer rounded-lg border border-border bg-white p-3 text-left transition hover:border-brand-300 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="tabular shrink-0 text-sm font-semibold text-ink">
                      #{order.number}
                    </span>
                    <OrderTypeBadge type={order.orderType} />
                  </span>
                  {status ? (
                    <TaskStatusBadge status={status} />
                  ) : statusesQuery.isLoading ? (
                    <Skeleton className="h-4 w-20 rounded-full" />
                  ) : (
                    // No task means nobody has been sent to do this yet — the
                    // one thing on this panel that needs someone to act.
                    <Badge tone="danger">Neprogramat</Badge>
                  )}
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

      <p className="mt-4 text-xs text-ink-subtle">
        Deschide o comandă pentru detalii, editare sau ștergere.
      </p>
    </Drawer>
  );
}
