/**
 * Produse's refusal dialog (TODO-57), and the one thing it has to do that the
 * subscription one does not: tell a placement from a pickup.
 *
 * A product is blocked by two order types at once, and they are opposite jobs —
 * "Amplasare, 3 buc." and "Ridicare, 3 buc." point the operator at completely
 * different work. The subscription dialog never faces that question: every
 * blocker there is an Igienizare.
 *
 * There is deliberately no bulk move here. Moving an order to another product
 * changes what is physically delivered, which is a decision per order.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BlockingProductOrder, ProductUsage } from '@/api';
import type { Product } from '@/types/domain';
import { ProductUsageModal } from '../components/ProductUsageModal';

const CABIN: Product = {
  id: 3,
  name: 'Toaletă Standard',
  description: null,
  price: 450,
  isActive: true,
};

const PLACEMENT: BlockingProductOrder = {
  id: 9,
  number: 41,
  clientName: 'Acme SRL',
  orderType: 'Amplasari',
  date: '2026-09-14',
  quantity: 3,
};

function usage(orders: BlockingProductOrder[]): ProductUsage {
  return { blocked: orders.length > 0, orders };
}

describe('ProductUsageModal', () => {
  it('names the product that could not be retired', () => {
    render(
      <ProductUsageModal
        product={CABIN}
        usage={usage([PLACEMENT])}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Toaletă Standard.*nu poate fi șters/ }),
    ).toBeInTheDocument();
  });

  it('labels each blocking order with its type, date and quantity', () => {
    render(
      <ProductUsageModal
        product={CABIN}
        usage={usage([
          PLACEMENT,
          {
            id: 10,
            number: 42,
            clientName: 'Ana Pop',
            orderType: 'Ridicari',
            date: null,
            quantity: null,
          },
        ])}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    expect(screen.getByText('Comenzi nefinalizate (2)')).toBeInTheDocument();
    expect(screen.getByText('#41')).toBeInTheDocument();
    expect(screen.getByText('Acme SRL')).toBeInTheDocument();
    expect(screen.getByText(/Amplasare · 14 sept\. 2026 · 3 buc\./)).toBeInTheDocument();
    // A pickup with neither date nor quantity still says what KIND of work it
    // is, and renders the missing date as the em dash rather than "Invalid Date".
    expect(screen.getByText('Ridicare · —')).toBeInTheDocument();
  });

  it('opens the order the operator picks, so the refusal is actionable', async () => {
    const user = userEvent.setup();
    const onOpenOrder = vi.fn();
    render(
      <ProductUsageModal
        product={CABIN}
        usage={usage([PLACEMENT])}
        onClose={() => {}}
        onOpenOrder={onOpenOrder}
      />,
    );

    await user.click(screen.getByRole('button', { name: /#41/ }));

    expect(onOpenOrder).toHaveBeenCalledExactlyOnceWith(9);
  });

  it('offers no way to bulk-move the blocking orders', () => {
    render(
      <ProductUsageModal
        product={CABIN}
        usage={usage([PLACEMENT])}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mută/ })).not.toBeInTheDocument();
  });

  it('closes on Am înțeles', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ProductUsageModal
        product={CABIN}
        usage={usage([PLACEMENT])}
        onClose={onClose}
        onOpenOrder={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Am înțeles' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
