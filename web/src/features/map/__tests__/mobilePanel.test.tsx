/**
 * The map's panel, at phone width (TODO-33).
 *
 * `Hartă` puts its filters, its statistics and — the part that matters — the
 * selected order in an aside that is `hidden md:flex`. Below `md` that made
 * tapping a pin a dead tap: the selection was set, nothing was drawn, and
 * there was no way to reach "Deschide comanda", the filters or the counts.
 *
 * These tests pin the two presentations rather than the markup: on a wide
 * viewport the aside is the panel and there is no button for it; on a narrow
 * one the ribbon carries the only way in, and selecting a point opens it.
 *
 * The aside is hidden with a Tailwind class rather than unmounted, and jsdom
 * applies no stylesheet — so "not visible below md" is not observable here.
 * What IS observable, and is the actual contract, is the sheet: below md the
 * panel appears in a dialog, and above it no dialog is opened at all.
 *
 * `MapCanvas` is mocked because it constructs a real MapLibre map, which needs
 * WebGL — the map screen is excluded from the smoke suite for the same reason.
 * The mock keeps the one thing this file is about: a point the user can tap.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/auth', () => ({
  useAuth: () => ({ hasRole: () => true }),
}));

vi.mock('../components/MapCanvas', () => ({
  MapCanvas: ({
    points,
    onSelectPoint,
  }: {
    points: { id: string; clientName: string }[];
    onSelectPoint: (id: string) => void;
  }) => (
    <div>
      {points.slice(0, 1).map((point) => (
        <button key={point.id} type="button" onClick={() => onSelectPoint(point.id)}>
          pin {point.clientName}
        </button>
      ))}
    </div>
  ),
}));

const { MapPage } = await import('../MapPage');

function renderMap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/harta']}>
        <MapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const panelButton = () =>
  screen.queryByRole('button', { name: 'Filtre, statistici și comanda selectată' });

/** The setup's matchMedia stub answers against `window.innerWidth`. */
function setViewport(width: number) {
  window.innerWidth = width;
}

describe('Hartă — the panel below md', () => {
  beforeEach(() => {
    setViewport(1024);
  });

  it('renders the panel inline on a wide viewport', async () => {
    renderMap();
    await waitFor(() => expect(screen.getByLabelText('Caută pe hartă')).toBeInTheDocument());
    // Inline, not in a dialog — the ribbon button is present in the DOM at
    // every width (it is `md:hidden`, a class jsdom does not apply), so the
    // sheet's absence is what distinguishes the two layouts here.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('puts the filters behind a ribbon button on a phone', async () => {
    setViewport(390);
    const user = userEvent.setup();
    renderMap();

    const open = await waitFor(() => {
      const button = panelButton();
      expect(button).not.toBeNull();
      return button!;
    });

    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(open);
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByLabelText('Caută pe hartă')).toBeInTheDocument();
  });

  it('opens the panel on the selected order when a pin is tapped', async () => {
    setViewport(390);
    const user = userEvent.setup();
    renderMap();

    const pin = await screen.findByRole('button', { name: /^pin / });
    await user.click(pin);

    // The order's own actions, not just the filters: a tap that selects
    // something the user cannot then act on is the bug this guards.
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('button', { name: 'Deschide comanda' })).toBeInTheDocument();
  });

  it('needs no sheet on a wide viewport — the aside is already the panel', async () => {
    const user = userEvent.setup();
    renderMap();

    const pin = await screen.findByRole('button', { name: /^pin / });
    await user.click(pin);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Deschide comanda' })).toBeInTheDocument();
  });
});
