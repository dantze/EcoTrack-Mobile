/**
 * One order, read.
 *
 * The same record is shown in two places and must not be written twice, so it
 * is one component with two frames around it:
 *
 *   `OrderDetailPane`   the Outlook reading pane — what `ListDetail` renders
 *                       beside the table on `lg+`, and inside its Sheet below
 *                       `lg`. No modal round-trip to look at a record.
 *   `OrderDetailDrawer` the standalone slide-over, for a caller that has no
 *                       reading pane to put it in.
 *
 * Both render `OrderDetailBody`. Anything added to an order shows up in both
 * automatically, which is the whole reason the body is a component rather than
 * a block of JSX inside the drawer.
 */

import { Pencil, Trash2 } from 'lucide-react';
import { Badge, Button, Drawer, Skeleton } from '@/components/ui';
import {
  ORDER_TYPE_LABELS,
  OrderTypeBadge,
  TaskStatusBadge,
  formatDate,
  formatMoney,
} from '@/components/domain';
import { type Order, clientName, parseCoordinates } from '@/types/domain';
import { useOrderTaskStatuses } from '../queries';
import { orderAddress, orderCoordinates, orderDateLabel } from '../orderModel';
import { DetailRow, DetailSection, Value } from './DetailList';

function MapsLink({ coordinates }: { coordinates: string | null }) {
  const point = parseCoordinates(coordinates);
  if (!point) return <>—</>;
  return (
    <a
      className="text-accent-600 underline underline-offset-2 hover:text-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
      target="_blank"
      rel="noreferrer"
    >
      {point.lat}, {point.lng}
    </a>
  );
}

/**
 * The order's task status, as a badge.
 *
 * "Neprogramat" is not a status the backend returns — it is the absence of a
 * task, and the one state on this panel that needs someone to act, so it is
 * shown in the danger tone rather than left blank.
 */
function OrderStatusBadge({ orderId }: { orderId: number }) {
  const statusesQuery = useOrderTaskStatuses([orderId]);
  const status = statusesQuery.data?.[orderId] ?? null;
  if (status) return <TaskStatusBadge status={status} />;
  if (statusesQuery.isLoading) return <Skeleton className="h-4 w-20 rounded-full" />;
  return <Badge tone="danger">Neprogramat</Badge>;
}

/** Identity line: what this order is, for whom, and when it is due. */
export function OrderDetailHeader({ order }: { order: Order }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular text-base font-semibold text-ink">Comanda #{order.number}</span>
        <OrderTypeBadge type={order.orderType} />
        <OrderStatusBadge orderId={order.id} />
      </div>
      <p className="truncate text-sm text-ink-muted">
        {clientName(order.client)}
        <span className="text-ink-subtle"> · {orderDateLabel(order)}</span>
      </p>
    </div>
  );
}

/** Every field of the order, grouped. Shared by the pane and the drawer. */
export function OrderDetailBody({ order }: { order: Order }) {
  return (
    <>
      <DetailSection title="General">
        <DetailRow label="Tip">{ORDER_TYPE_LABELS[order.orderType]}</DetailRow>
        <DetailRow label="Înregistrată">{formatDate(order.date)}</DetailRow>
        <DetailRow label="Client">
          {clientName(order.client)} ({order.client.type === 'company' ? 'PJ' : 'PF'})
        </DetailRow>
        <DetailRow label="Telefon client">
          <Value>{order.client.phone}</Value>
        </DetailRow>
        <DetailRow label="Email client">
          <Value>{order.client.email}</Value>
        </DetailRow>
        <DetailRow label="Contact șantier">
          <Value>{order.contact}</Value>
        </DetailRow>
      </DetailSection>

      {order.orderType === 'Amplasari' && (
        <DetailSection title="Amplasare">
          <DetailRow label="Produs">
            <Value>{order.product?.name}</Value>
          </DetailRow>
          <DetailRow label="Cantitate">
            <Value>{order.quantity}</Value>
          </DetailRow>
          <DetailRow label="Preț total">
            {order.product && order.quantity
              ? formatMoney(order.product.price * order.quantity)
              : '—'}
          </DetailRow>
          <DetailRow label="Perioadă">
            {formatDate(order.startDate)} –{' '}
            {order.isIndefinite ? 'nedeterminat' : formatDate(order.endDate)}
          </DetailRow>
          <DetailRow label="Durată">
            {order.isIndefinite ? 'Nedeterminat' : <Value>{order.durationDays}</Value>}
          </DetailRow>
          <DetailRow label="Igienizări/lună">
            <Value>{order.igienizariPerMonth}</Value>
          </DetailRow>
        </DetailSection>
      )}

      {order.orderType === 'Ridicari' && (
        <DetailSection title="Ridicare">
          <DetailRow label="Produs">
            <Value>{order.pickupProductName ?? order.product?.name}</Value>
          </DetailRow>
          <DetailRow label="Cantitate">
            <Value>{order.pickupQuantity}</Value>
          </DetailRow>
          <DetailRow label="Dată ridicare">{formatDate(order.pickupDate)}</DetailRow>
        </DetailSection>
      )}

      {order.orderType === 'Igienizari' && (
        <DetailSection title="Igienizare">
          <DetailRow label="Abonament">
            <Value>{order.subscription?.name}</Value>
          </DetailRow>
          <DetailRow label="Preț">{formatMoney(order.subscription?.price ?? null)}</DetailRow>
          <DetailRow label="Dată igienizare">{formatDate(order.sanitationDate)}</DetailRow>
          <DetailRow label="Plan recurent">
            {order.recurringPlan
              ? `La ${order.recurringPlan.frequencyDays} zile${
                  order.recurringPlan.isIndefinite
                    ? ' · nedeterminat'
                    : order.recurringPlan.endDate
                      ? ` · până la ${formatDate(order.recurringPlan.endDate)}`
                      : ''
                }`
              : '—'}
          </DetailRow>
        </DetailSection>
      )}

      <DetailSection title="Locație">
        <DetailRow label="Adresă">
          <Value>{orderAddress(order)}</Value>
        </DetailRow>
        <DetailRow label="Coordonate">
          <MapsLink coordinates={orderCoordinates(order)} />
        </DetailRow>
      </DetailSection>

      <DetailSection title="Detalii">
        <DetailRow label="Note">
          <Value>{order.details}</Value>
        </DetailRow>
      </DetailSection>
    </>
  );
}

export interface OrderDetailActions {
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * The reading pane.
 *
 * Its actions sit in a row under the identity line rather than in a footer:
 * the pane has no bottom edge of its own on `lg+`, and an action bar that
 * floats halfway down a tall column reads as belonging to whatever it happens
 * to be next to.
 */
export function OrderDetailPane({
  order,
  onEdit,
  onDelete,
}: { order: Order } & OrderDetailActions) {
  return (
    <div
      role="region"
      aria-label={`Comanda #${order.number}`}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <OrderDetailHeader order={order} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon={<Pencil aria-hidden />} onClick={onEdit}>
            Editează
          </Button>
          <Button size="sm" variant="danger" icon={<Trash2 aria-hidden />} onClick={onDelete}>
            Șterge
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <OrderDetailBody order={order} />
      </div>
    </div>
  );
}

/** Standalone slide-over, for a caller with no reading pane to render into. */
export function OrderDetailDrawer({
  order,
  onClose,
  onEdit,
  onDelete,
}: { order: Order; onClose: () => void } & OrderDetailActions) {
  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-2">
          Comanda #{order.number}
          <OrderTypeBadge type={order.orderType} />
          <OrderStatusBadge orderId={order.id} />
        </span>
      }
      footer={
        <>
          <Button variant="danger" icon={<Trash2 aria-hidden />} onClick={onDelete}>
            Șterge
          </Button>
          <Button variant="primary" icon={<Pencil aria-hidden />} onClick={onEdit}>
            Editează
          </Button>
        </>
      }
    >
      <OrderDetailBody order={order} />
    </Drawer>
  );
}
