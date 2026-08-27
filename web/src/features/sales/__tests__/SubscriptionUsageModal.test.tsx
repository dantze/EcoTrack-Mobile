/**
 * The refusal dialog's job is to be actionable: name what is blocking, and get
 * the operator to it. A dialog that only says "still in use" leaves them
 * hunting through Comenzi by hand.
 *
 * Recurring plans deliberately are NOT links — Igienizări recurente is a Tehnic
 * screen and this is a Vânzări one, so a Sales-only account would land on
 * "acces interzis".
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SubscriptionUsage } from '@/api';
import type { Subscription } from '@/types/domain';
import { SubscriptionUsageModal } from '../components/SubscriptionUsageModal';

const PLAN: Subscription = {
  id: 3,
  name: 'Igienizare lunară',
  description: null,
  type: 'RECURRING',
  price: 250,
  visitsPerMonth: 1,
  durationMonths: null,
  isIndefinite: false,
  isActive: true,
};

function usage(overrides: Partial<SubscriptionUsage> = {}): SubscriptionUsage {
  return { blocked: true, orders: [], recurringPlans: [], ...overrides };
}

describe('SubscriptionUsageModal', () => {
  it('names the plan that could not be retired', () => {
    render(
      <SubscriptionUsageModal
        subscription={PLAN}
        usage={usage({
          orders: [{ id: 9, number: 41, clientName: 'Ana Pop', sanitationDate: '2026-09-14' }],
        })}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /Igienizare lunară.*nu poate fi șters/ }),
    ).toBeInTheDocument();
  });

  it('lists each blocking order with its number, client and date', () => {
    render(
      <SubscriptionUsageModal
        subscription={PLAN}
        usage={usage({
          orders: [
            { id: 9, number: 41, clientName: 'Ana Pop', sanitationDate: '2026-09-14' },
            { id: 10, number: 42, clientName: 'Construct SRL', sanitationDate: null },
          ],
        })}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    expect(screen.getByText('Comenzi nefinalizate (2)')).toBeInTheDocument();
    expect(screen.getByText('#41')).toBeInTheDocument();
    expect(screen.getByText('Ana Pop')).toBeInTheDocument();
    expect(screen.getByText('Construct SRL')).toBeInTheDocument();
    // A missing date renders as the em dash, not as "Invalid Date".
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('opens the order the operator picks, so the refusal is actionable', async () => {
    const user = userEvent.setup();
    const onOpenOrder = vi.fn();
    render(
      <SubscriptionUsageModal
        subscription={PLAN}
        usage={usage({
          orders: [{ id: 9, number: 41, clientName: 'Ana Pop', sanitationDate: '2026-09-14' }],
        })}
        onClose={() => {}}
        onOpenOrder={onOpenOrder}
      />,
    );

    await user.click(screen.getByRole('button', { name: /#41/ }));

    expect(onOpenOrder).toHaveBeenCalledExactlyOnceWith(9);
  });

  it('lists active recurring plans as plain rows, never as links', () => {
    render(
      <SubscriptionUsageModal
        subscription={PLAN}
        usage={usage({
          recurringPlans: [{ id: 5, clientName: 'Ana Pop', frequencyDays: 30 }],
        })}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    const section = screen.getByText('Planuri recurente active (1)').closest('section');
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText('Ana Pop')).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText('la 30 zile')).toBeInTheDocument();
    expect(within(section as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows only the sections that actually have blockers', () => {
    render(
      <SubscriptionUsageModal
        subscription={PLAN}
        usage={usage({
          orders: [{ id: 9, number: 41, clientName: 'Ana Pop', sanitationDate: null }],
        })}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    expect(screen.queryByText(/Planuri recurente active/)).not.toBeInTheDocument();
  });
});
