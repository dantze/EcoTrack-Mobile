/**
 * The client reading pane.
 *
 * What an operator on the phone to a client actually needs, in the order they
 * need it: who this is, how to reach them, and what has been ordered. The
 * orders come from the list the screen has already loaded — no second request
 * for something already in the cache.
 *
 * Editing stays in the drawer. The pane is for reading; a form that lives in a
 * pane you can navigate away from mid-edit is how half-typed records happen.
 */

import { Building2, Mail, MapPin, Phone, User } from 'lucide-react';
import { Badge, Button, EmptyState } from '@/components/ui';
import { OrderTypeBadge } from '@/components/domain';
import { PaneHeader } from '@/components/layout';
import { cn } from '@/lib/utils';
import { type Client, type Order, clientName } from '@/types/domain';
import { orderDateLabel, orderPrimaryDate, orderSummary } from '../orderModel';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase();
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] tracking-wide text-ink-subtle uppercase">{label}</p>
        {value ? (
          href ? (
            <a
              href={href}
              className="text-sm break-words text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {value}
            </a>
          ) : (
            <p className="text-sm break-words text-ink">{value}</p>
          )
        ) : (
          <p className="text-sm text-ink-subtle">—</p>
        )}
      </div>
    </div>
  );
}

export function ClientDetailPane({
  client,
  orders,
  onEdit,
  onDelete,
  onNewOrder,
  onOpenOrder,
}: {
  client: Client;
  /** Every order in the cache; this component picks out the client's own. */
  orders: readonly Order[];
  onEdit: () => void;
  onDelete: () => void;
  onNewOrder: () => void;
  onOpenOrder: (order: Order) => void;
}) {
  const name = clientName(client);
  const isCompany = client.type === 'company';
  const own = orders
    .filter((order) => order.client.id === client.id)
    .sort((left, right) => (orderPrimaryDate(right) ?? '').localeCompare(orderPrimaryDate(left) ?? ''));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        title={
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold',
                isCompany
                  ? 'bg-info-100 text-info-700'
                  : 'bg-surface-active text-ink',
              )}
            >
              {initials(name)}
            </span>
            <span className="truncate">{name}</span>
          </span>
        }
        subtitle={
          <span className="flex items-center gap-1.5">
            {isCompany ? <Building2 className="size-3" /> : <User className="size-3" />}
            {isCompany ? 'Persoană juridică' : 'Persoană fizică'}
            <span aria-hidden>·</span>
            <span className="tabular">{(isCompany ? client.CUI : client.CNP) ?? '—'}</span>
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="primary" onClick={onNewOrder}>
              Comandă
            </Button>
            <Button size="sm" variant="secondary" onClick={onEdit}>
              Editează
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              Șterge
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <section aria-label="Date de contact" className="divide-y divide-border">
          <ContactRow
            icon={Phone}
            label="Telefon"
            value={client.phone ?? null}
            href={client.phone ? `tel:${client.phone.replace(/\s/g, '')}` : undefined}
          />
          <ContactRow
            icon={Mail}
            label="Email"
            value={client.email ?? null}
            href={client.email ? `mailto:${client.email}` : undefined}
          />
          <ContactRow icon={MapPin} label="Adresă" value={client.address ?? null} />
        </section>

        <section aria-label="Comenzile clientului" className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
            Comenzi
            <Badge tone="neutral">{own.length}</Badge>
          </h3>

          {own.length === 0 ? (
            <EmptyState
              title="Nicio comandă"
              body="Acest client nu are încă nicio comandă."
              action={
                <Button size="sm" variant="secondary" onClick={onNewOrder}>
                  Creează prima comandă
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {own.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => onOpenOrder(order)}
                    className="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="tabular w-12 shrink-0 text-xs text-ink-subtle">
                      #{order.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{orderSummary(order)}</span>
                      <span className="block truncate text-xs text-ink-subtle">
                        {orderDateLabel(order)}
                      </span>
                    </span>
                    <OrderTypeBadge type={order.orderType} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
