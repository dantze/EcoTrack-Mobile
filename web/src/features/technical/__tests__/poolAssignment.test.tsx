/**
 * The unassigned queue can be emptied without a mouse (TODO-63).
 *
 * `RoutesPage` assigns work by dragging from "Neasignate" onto a route, and
 * dragging was the ONLY way out of that queue. That made the board's central
 * action unreachable twice over: from the keyboard at any width, and on a phone
 * at all — below `lg` the three columns become tabs, so the drag source and the
 * drop target are rarely on screen at the same time.
 *
 * What is tested is the path, not the pixels: that every queued task offers a
 * button, that it opens the route picker, and that choosing a route assigns the
 * task. A drag cannot be exercised in jsdom at all, which is part of why this
 * gap survived — the only path that existed was the only path no test could
 * reach.
 */

import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { api } from '@/api';
import { RoutesPage } from '../RoutesPage';

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/rute']}>
        <RoutesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * The queue's send buttons, found by their label rather than by walking to the
 * "Neasignate" column: that text appears twice (the tab and the panel header),
 * so a `getByText` for it is ambiguous.
 */
async function sendButtons(): Promise<HTMLElement[]> {
  return await screen.findAllByRole('button', { name: /^Trimite pe rută:/ });
}

describe('assigning from the unassigned queue', () => {
  it('offers a send action on every queued task', async () => {
    renderBoard();

    await waitFor(async () => {
      expect((await sendButtons()).length).toBeGreaterThan(0);
    });
  });

  it('opens the route picker, and offers the selected route as a destination', async () => {
    // A task in the queue is on NO route, so unlike "Mută" on a route stop
    // nothing is excluded — the currently selected route is usually where it
    // is going, and filtering it out would remove the best answer.
    const user = userEvent.setup();
    renderBoard();

    const [first] = await waitFor(async () => {
      const buttons = await sendButtons();
      expect(buttons.length).toBeGreaterThan(0);
      return buttons;
    });

    await user.click(first!);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Trimite sarcina pe o rută')).toBeInTheDocument();

    const routes = await api.routes.list();
    await waitFor(() => {
      expect(within(dialog).getAllByRole('button').length).toBeGreaterThan(1);
    });
    // Every route is a candidate, including whichever one the board has open.
    for (const route of routes.slice(0, 2)) {
      expect(within(dialog).getByText(new RegExp(route.name, 'i'))).toBeInTheDocument();
    }
  });

  it('assigns the task to the route that was chosen', async () => {
    const user = userEvent.setup();
    renderBoard();

    const before = (await api.tasks.list()).filter((task) => task.route === null).length;
    expect(before).toBeGreaterThan(0);

    const [first] = await waitFor(async () => {
      const buttons = await sendButtons();
      expect(buttons.length).toBeGreaterThan(0);
      return buttons;
    });
    await user.click(first!);

    const dialog = await screen.findByRole('dialog');
    const routes = await api.routes.list();
    const target = within(dialog).getByText(new RegExp(routes[0]!.name, 'i'));
    await user.click(target);

    await waitFor(async () => {
      const after = (await api.tasks.list()).filter((task) => task.route === null).length;
      expect(after).toBe(before - 1);
    });
  });
});
