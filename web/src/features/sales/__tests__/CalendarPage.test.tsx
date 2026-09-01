/**
 * Calendar end to end against the mock API — the screen fetching real seeded
 * orders, bucketing them and opening a day.
 *
 * The pure helpers are covered in `calendar.test.ts` and the grid's behaviour in
 * `MonthGrid.test.tsx`; what neither can catch is the screen failing to mount,
 * or a tile that opens a panel with nothing in it. This is the piece that would
 * otherwise only be verified by looking at a browser.
 */

import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CalendarPage } from '../CalendarPage';

function renderCalendar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/calendar']}>
        <CalendarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Day tiles are the only buttons whose name carries an order count. */
function dayTiles() {
  return screen.queryAllByRole('button', { name: /— \d+ (de )?(comenzi|comandă)$/ });
}

describe('CalendarPage', () => {
  it('lays the month out as seven Monday-first columns', async () => {
    renderCalendar();

    await waitFor(() => expect(screen.queryByText('Se încarcă…')).not.toBeInTheDocument());

    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
    for (const day of ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  it('opens the day panel with that day’s orders when a tile is clicked', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await waitFor(() => expect(dayTiles().length).toBeGreaterThan(0));

    const tile = dayTiles()[0];
    const tileName = tile.getAttribute('aria-label') ?? '';
    // "Joi, 6 august 2026 — 3 comenzi" → the day, and how many to expect.
    const [dayPart, countPart] = tileName.split(' — ');
    const expected = Number.parseInt(countPart, 10);

    await user.click(tile);

    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText(dayPart)).toBeInTheDocument();
    // One button per order, plus the header's Închide and the footer's.
    expect(within(panel).getAllByText(/^#\d+$/)).toHaveLength(expected);
  });

  it('steps to another month and back to today', async () => {
    const user = userEvent.setup();
    renderCalendar();

    await waitFor(() => expect(screen.queryByText('Se încarcă…')).not.toBeInTheDocument());
    const heading = screen.getByRole('button', { name: 'Luna următoare' });
    const monthBefore = heading.previousElementSibling?.textContent ?? '';

    await user.click(heading);
    expect(heading.previousElementSibling?.textContent).not.toBe(monthBefore);

    await user.click(screen.getByRole('button', { name: 'Azi' }));
    expect(heading.previousElementSibling?.textContent).toBe(monthBefore);
  });
});
