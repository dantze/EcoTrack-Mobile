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

const OTHER_PLAN: Subscription = { ...PLAN, id: 4, name: 'Igienizare trimestrială' };

/**
 * The move props (TODO-37) that every case needs but most do not care about.
 * Spread first so a case can override any of them.
 */
const MOVE_PROPS = {
  moveTargets: [OTHER_PLAN],
  onMoveOrders: () => {},
  moving: false,
};

describe('SubscriptionUsageModal', () => {
  it('names the plan that could not be retired', () => {
    render(
      <SubscriptionUsageModal
        {...MOVE_PROPS}
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
        {...MOVE_PROPS}
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
        {...MOVE_PROPS}
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
        {...MOVE_PROPS}
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
        {...MOVE_PROPS}
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
  // -------------------------------------------------------------------------
  // Mută pe alt abonament (TODO-37)
  // -------------------------------------------------------------------------

  it('moves exactly the orders it listed, to the chosen plan', async () => {
    const onMoveOrders = vi.fn();
    const user = userEvent.setup();
    render(
      <SubscriptionUsageModal
        {...MOVE_PROPS}
        subscription={PLAN}
        usage={usage({
          orders: [
            { id: 9, number: 41, clientName: 'Ana Pop', sanitationDate: null },
            { id: 10, number: 42, clientName: 'Construct SRL', sanitationDate: null },
          ],
        })}
        onClose={() => {}}
        onOpenOrder={() => {}}
        onMoveOrders={onMoveOrders}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: /Abonamentul destinație/ }));
    await user.click(screen.getByRole('option', { name: 'Igienizare trimestrială' }));
    await user.click(screen.getByRole('button', { name: 'Mută 2 comenzi' }));

    // The ids come from the list the operator just read - not "everything on
    // the plan", which could have grown since the dialog opened.
    expect(onMoveOrders).toHaveBeenCalledWith(4, [9, 10]);
  });

  it('cannot move until a target is chosen', () => {
    render(
      <SubscriptionUsageModal
        {...MOVE_PROPS}
        subscription={PLAN}
        usage={usage({
          orders: [{ id: 9, number: 41, clientName: 'Ana Pop', sanitationDate: null }],
        })}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Mută 1 comandă' })).toBeDisabled();
  });

  it('says the delete will still fail while a recurring plan blocks it', () => {
    render(
      <SubscriptionUsageModal
        {...MOVE_PROPS}
        subscription={PLAN}
        usage={usage({
          orders: [{ id: 9, number: 41, clientName: 'Ana Pop', sanitationDate: null }],
          recurringPlans: [{ id: 5, clientName: 'Ana Pop', frequencyDays: 30 }],
        })}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    // Promising a delete that cannot happen is worse than not offering the move.
    expect(screen.getByText(/tot nu va putea fi șters/)).toBeInTheDocument();
  });

  it('offers no move at all when there is nowhere to move to', () => {
    render(
      <SubscriptionUsageModal
        {...MOVE_PROPS}
        subscription={PLAN}
        moveTargets={[]}
        usage={usage({
          orders: [{ id: 9, number: 41, clientName: 'Ana Pop', sanitationDate: null }],
        })}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: /^Mută / })).not.toBeInTheDocument();
    expect(screen.getByText(/Nu există alt abonament activ/)).toBeInTheDocument();
  });

  it('offers no move when only recurring plans block', () => {
    render(
      <SubscriptionUsageModal
        {...MOVE_PROPS}
        subscription={PLAN}
        usage={usage({
          recurringPlans: [{ id: 5, clientName: 'Ana Pop', frequencyDays: 30 }],
        })}
        onClose={() => {}}
        onOpenOrder={() => {}}
      />,
    );

    // Moving a recurring plan would keep it generating orders against the plan
    // being retired; it is stopped from Igienizări recurente instead.
    expect(screen.queryByText('Mută pe alt abonament')).not.toBeInTheDocument();
  });
});
