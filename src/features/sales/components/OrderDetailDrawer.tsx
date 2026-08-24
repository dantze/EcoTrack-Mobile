/**
 * Order detail in a slide-over, so the table underneath keeps its scroll
 * position and filters — the desktop replacement for the mobile OrderDetails
 * screen.
 */

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
import { orderAddress, orderCoordinates } from '../orderModel';
import { DetailRow, DetailSection, Value } from './DetailList';

function MapsLink({ coordinates }: { coordinates: string | null }) {
  const point = parseCoordinates(coordinates);
  if (!point) return <>—</>;
  return (
    <a
      className="text-brand-500 underline underline-offset-2"
      href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
      target="_blank"
      rel="noreferrer"
    >
      {point.lat}, {point.lng}
    </a>
  );
}

export function OrderDetailDrawer({
  order,
  onClose,
  onEdit,
  onDelete,
}: {
  order: Order;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusesQuery = useOrderTaskStatuses([order.id]);
  const taskStatus = statusesQuery.data?.[order.id] ?? null;

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-2">
          Comanda #{order.number}
          <OrderTypeBadge type={order.orderType} />
          {taskStatus ? (
            <TaskStatusBadge status={taskStatus} />
          ) : statusesQuery.isLoading ? (
            <Skeleton className="h-4 w-20 rounded-full" />
          ) : (
            <Badge tone="danger">Neprogramat</Badge>
          )}
        </span>
      }
      footer={
        <>
          <Button variant="danger" onClick={onDelete}>
            Șterge
          </Button>
          <Button variant="primary" onClick={onEdit}>
            Editează
          </Button>
        </>
      }
    >
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
    </Drawer>
  );
}
