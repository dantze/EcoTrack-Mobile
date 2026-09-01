/**
 * The calendar grid's behaviour contract, which is mostly about what a day tile
 * IS:
 *   - a day holding orders is a button that reports the day it stands for, and
 *     announces the date and the count rather than a bare number;
 *   - an empty day is not focusable at all, so tabbing through a month reaches
 *     the busy days instead of twenty dead stops;
 *   - the summary under the date names every order type present, and only those.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Order } from '@/types/domain';
import { MonthGrid } from '../components/MonthGrid';
import { type DayBucket } from '../calendar';

/** The grid only reads `id`/`number`/`orderType` off an order. */
function bucket(iso: string, counts: Partial<DayBucket['counts']>): DayBucket {
  const full = { Amplasari: 0, Ridicari: 0, Igienizari: 0, ...counts };
  const total = full.Amplasari + full.Ridicari + full.Igienizari;
  return { iso, orders: [] as unknown as Order[], counts: full, total };
}

const CELLS = [
  { iso: '2026-08-10', dayOfMonth: 10, inMonth: true, isToday: true, isWeekend: false },
  { iso: '2026-08-11', dayOfMonth: 11, inMonth: true, isToday: false, isWeekend: false },
];

describe('MonthGrid', () => {
  it('makes a day with orders a button that names the date and the count', () => {
    render(
      <MonthGrid
        cells={CELLS}
        buckets={new Map([['2026-08-10', bucket('2026-08-10', { Amplasari: 2, Ridicari: 1 })]])}
        selectedIso={null}
        onSelectDay={() => {}}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Luni, 10 august 2026 — 3 comenzi' }),
    ).toBeInTheDocument();
  });

  it('reports the day it stands for when clicked', async () => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();
    render(
      <MonthGrid
        cells={CELLS}
        buckets={new Map([['2026-08-10', bucket('2026-08-10', { Igienizari: 1 })]])}
        selectedIso={null}
        onSelectDay={onSelectDay}
      />,
    );

    await user.click(screen.getByRole('button', { name: /10 august 2026/ }));

    expect(onSelectDay).toHaveBeenCalledExactlyOnceWith('2026-08-10');
  });

  it('leaves an empty day out of the tab order entirely', () => {
    render(
      <MonthGrid
        cells={CELLS}
        buckets={new Map([['2026-08-10', bucket('2026-08-10', { Amplasari: 1 })]])}
        selectedIso={null}
        onSelectDay={() => {}}
      />,
    );

    // The 11th has nothing on it: one button in the whole grid, not two.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  it('summarises only the order types actually present that day', () => {
    render(
      <MonthGrid
        cells={CELLS}
        buckets={new Map([['2026-08-10', bucket('2026-08-10', { Amplasari: 2, Igienizari: 1 })]])}
        selectedIso={null}
        onSelectDay={() => {}}
      />,
    );

    const tile = screen.getByRole('button', { name: /10 august 2026/ });
    // Plural above one, singular at one — "2 Amplasare" would read as broken
    // Romanian on the busiest tiles.
    expect(within(tile).getByText('Amplasări', { exact: false })).toBeInTheDocument();
    expect(within(tile).getByText('Igienizare', { exact: false })).toBeInTheDocument();
    expect(within(tile).queryByText('Ridic', { exact: false })).not.toBeInTheDocument();
  });

  it('marks today so it is findable without counting rows', () => {
    render(
      <MonthGrid
        cells={CELLS}
        buckets={new Map([['2026-08-10', bucket('2026-08-10', { Amplasari: 1 })]])}
        selectedIso={null}
        onSelectDay={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /10 august 2026/ })).toHaveAttribute(
      'aria-current',
      'date',
    );
  });
});
