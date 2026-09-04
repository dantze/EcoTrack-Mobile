/**
 * `PageHeader` is `CommandBar` (TODO-62).
 *
 * The two used to be separate implementations of the same strip, kept identical
 * by hand and documented as "the two must stay visually identical". They had
 * already drifted. This asserts the only thing that keeps that promise
 * cheaply — that there is one implementation — rather than trying to compare
 * two sets of class names, which is what a hand-maintained match amounts to.
 *
 * If someone re-inlines the markup here to add a variant, the `data-slot`
 * assertion fails and this comment is what they read.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('renders the CommandBar strip, not markup of its own', () => {
    const { container } = render(<PageHeader title="Comenzi" />);

    expect(container.querySelector('[data-slot="command-bar"]')).not.toBeNull();
  });

  it('shows the title and subtitle', () => {
    render(<PageHeader title="Comenzi" subtitle="12 curente" />);

    expect(screen.getByRole('heading', { name: 'Comenzi' })).toBeInTheDocument();
    expect(screen.getByText('12 curente')).toBeInTheDocument();
  });

  it('puts `actions` on the title row, where PageHeader always put them', () => {
    // Mapped to CommandBar's `tools`, not its `actions` — those are the ribbon
    // strip BELOW the title, which would move the buttons down a row.
    render(<PageHeader title="Comenzi" actions={<button type="button">Adaugă</button>} />);

    const heading = screen.getByRole('heading', { name: 'Comenzi' });
    const button = screen.getByRole('button', { name: 'Adaugă' });
    const titleRow = heading.parentElement?.parentElement;

    expect(titleRow).not.toBeNull();
    expect(titleRow!.contains(button)).toBe(true);
  });

  it('docks `below` under the strip', () => {
    render(<PageHeader title="Comenzi" below={<div data-testid="tabs">Curente / Arhivă</div>} />);

    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });
});
