/**
 * Why a product cannot be retired yet, with the blocking orders named (TODO-57).
 *
 * The twin of `SubscriptionUsageModal`, built on the same shell: retiring a
 * product is refused by the same rule as retiring a plan, so the refusal has to
 * be equally actionable. Until this existed Produse said *"3 comenzi
 * nefinalizate îl folosesc încă"* and stopped there, and the only way to find
 * out which three was to search Comenzi by hand.
 *
 * **No bulk move, deliberately.** Abonamente offers one (TODO-37) because the
 * plan an order is sold under is a commercial label; the product is what is
 * physically delivered, so re-pointing an order at a different one is a real
 * decision per order — the operator makes it in Comenzi, on the order itself.
 *
 * Both order types that carry a product appear here. An Igienizare never does:
 * it carries a subscription instead, which is the other dialog's business.
 */

import { ORDER_TYPE_LABELS, formatDate } from '@/components/domain';
import type { BlockingProductOrder, ProductUsage } from '@/api';
import type { OrderTypeTag, Product } from '@/types/domain';
import { BlockingOrderList, UsageModal } from './UsageModal';

export interface ProductUsageModalProps {
  product: Product;
  usage: ProductUsage;
  onClose: () => void;
  onOpenOrder: (orderId: number) => void;
}

/**
 * "Amplasare · 14 sept. 2026 · 3 buc." — the three facts that tell one blocking
 * order from another at a glance. The type is worth naming here (unlike the
 * subscription dialog, where every blocker is an Igienizare) because a product
 * is blocked by placements and pickups at once, and they are opposite jobs.
 *
 * `orderType` is a plain string on the wire; an unknown one falls back to what
 * the server sent rather than blanking the row.
 */
function orderMeta(order: BlockingProductOrder): string {
  const label = ORDER_TYPE_LABELS[order.orderType as OrderTypeTag] ?? order.orderType;
  const parts = [label, formatDate(order.date)];
  if (order.quantity !== null) parts.push(`${order.quantity} buc.`);
  return parts.join(' · ');
}

export function ProductUsageModal({
  product,
  usage,
  onClose,
  onOpenOrder,
}: ProductUsageModalProps) {
  return (
    <UsageModal
      title={`Produsul „${product.name}” nu poate fi șters`}
      intro="Produsul este încă folosit de comenzi nefinalizate. Finalizați sau ștergeți comenzile de mai jos, apoi încercați din nou."
      onClose={onClose}
    >
      <BlockingOrderList
        heading="Comenzi nefinalizate"
        orders={usage.orders.map((order) => ({
          id: order.id,
          number: order.number,
          clientName: order.clientName,
          meta: orderMeta(order),
        }))}
        onOpenOrder={onOpenOrder}
      />
      <p className="mt-3 text-xs text-ink-subtle">
        Ștergerea produsului îl scoate din liste, dar îl păstrează pe comenzile deja finalizate — de
        aceea doar comenzile nefinalizate îl blochează.
      </p>
    </UsageModal>
  );
}
