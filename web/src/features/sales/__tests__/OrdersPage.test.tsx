/**
 * The Curente / Arhivă split on Comenzi (TODO-21), end to end against the mock
 * API — the screen fetching real seeded orders, asking for each one's task
 * status and partitioning the table on the answer.
 *
 * What is worth testing here is the definition, not the layout: an order is
 * archived when it has a COMPLETED task and never for any other reason. The
 * failure mode this guards against is the archive quietly swallowing work that
 * was never carried out — an order with no task at all, whose date happens to
 * be in the past, which `deriveLifecycle` on the map would call 'done'.
 */

import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { OrdersPage } from '../OrdersPage';

function renderOrders() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/comenzi']}>
        <OrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Data rows of the orders table, header row excluded. */
function dataRows(): HTMLElement[] {
  const body = document.querySelector('tbody');
  if (!body) return [];
  return [...body.querySelectorAll('tr')].filter(
    (row) => within(row as HTMLElement).queryByText(/^#\d+$/) !== null,
  ) as HTMLElement[];
}

function tab(name: 'Curente' | 'Arhivă'): HTMLElement {
  return screen.getByRole('tab', { name: new RegExp(`^${name}`) });
}

/** Waits for the per-order status fetches to settle into badges. */
async function waitForStatuses() {
  await waitFor(() => expect(dataRows().length).toBeGreaterThan(0));
  await waitFor(
    () => expect(document.querySelectorAll('tbody .animate-pulse').length).toBe(0),
    { timeout: 5000 },
  );
}

describe('OrdersPage — Curente / Arhivă', () => {
  it('keeps every unfinished order in Curente and none of them in Arhivă', async () => {
    const user = userEvent.setup();
    renderOrders();
    await waitForStatuses();

    // Nothing finished is left in the working list…
    for (const row of dataRows()) {
      expect(within(row).queryByText('Finalizat')).toBeNull();
    }

    await user.click(tab('Arhivă'));
    await waitForStatuses();

    // …and everything in the archive got there by being finished.
    const archived = dataRows();
    expect(archived.length).toBeGreaterThan(0);
    for (const row of archived) {
      expect(within(row).getByText('Finalizat')).toBeInTheDocument();
    }
  });

  it('never archives an order that has no task, whatever its date says', async () => {
    const user = userEvent.setup();
    renderOrders();
    await waitForStatuses();

    // "Neprogramat" is the badge for an order with no task at all. Those are
    // exactly the rows a date-based rule would wrongly retire.
    const unscheduledInCurrent = screen.queryAllByText('Neprogramat').length;
    expect(unscheduledInCurrent).toBeGreaterThan(0);

    await user.click(tab('Arhivă'));
    await waitForStatuses();

    expect(screen.queryAllByText('Neprogramat')).toHaveLength(0);
  });

  it('splits the orders between the two tabs without losing or duplicating any', async () => {
    renderOrders();
    await waitForStatuses();

    const count = (name: 'Curente' | 'Arhivă') =>
      Number(tab(name).textContent?.replace(name, '').trim());

    const current = count('Curente');
    const archived = count('Arhivă');
    expect(current).toBe(dataRows().length);

    // The subtitle reports the unsplit total the two tabs are drawn from.
    const subtitle = screen.getByText(/comenzi curente din \d+ în total/);
    const total = Number(subtitle.textContent?.match(/din (\d+) în total/)?.[1]);
    expect(current + archived).toBe(total);
  });
});
