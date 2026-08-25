/**
 * The Sales filter strip — shared by all four Sales screens, so a regression
 * here shows up on every one of them at once.
 *
 * What is actually worth asserting is the accessibility contract, because it
 * is invisible in a browser until someone uses a keyboard or a screen reader:
 *   - the search box has an accessible name (the placeholder doubles as one);
 *   - passing `controls` promotes it from a plain input to an ARIA combobox
 *     with the listbox wiring the command palette relies on, and NOT passing it
 *     must leave those attributes off entirely rather than empty;
 *   - `FilterField` associates its label with the control it wraps;
 *   - `ErrorNotice` renders a retry affordance only when a retry exists.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ErrorNotice, FilterBar, FilterField, SearchInput } from '../components/FilterBar';

describe('SearchInput', () => {
  it('exposes the placeholder as its accessible name', () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Caută comenzi" />);

    expect(screen.getByRole('searchbox', { name: 'Caută comenzi' })).toBeInTheDocument();
  });

  it('reports every keystroke to the caller', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} placeholder="Caută" />);

    await user.type(screen.getByRole('searchbox'), 'acme');

    // Controlled with a fixed value, so each keystroke reports a single char.
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenLastCalledWith('e');
  });

  it('is controlled: the rendered value follows the prop', async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [value, setValue] = useState('');
      return <SearchInput value={value} onChange={setValue} placeholder="Caută" />;
    }
    render(<Controlled />);

    const box = screen.getByRole('searchbox');
    await user.type(box, 'acme');

    expect(box).toHaveValue('acme');
  });

  it('stays a plain searchbox when no listbox is wired to it', () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Caută" />);
    const box = screen.getByRole('searchbox');

    // Absent, not empty: an aria-controls="" would point a screen reader at
    // nothing and aria-expanded on a non-combobox is a lie.
    expect(box).not.toHaveAttribute('aria-controls');
    expect(box).not.toHaveAttribute('aria-expanded');
    expect(box).not.toHaveAttribute('aria-autocomplete');
  });

  it('becomes a combobox with full listbox wiring once `controls` is supplied', () => {
    render(
      <SearchInput
        value="ac"
        onChange={() => {}}
        placeholder="Caută"
        controls="client-options"
        activeDescendant="client-option-3"
      />,
    );

    const box = screen.getByRole('combobox', { name: 'Caută' });
    expect(box).toHaveAttribute('aria-controls', 'client-options');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    expect(box).toHaveAttribute('aria-autocomplete', 'list');
    expect(box).toHaveAttribute('aria-activedescendant', 'client-option-3');
  });
});

describe('FilterField', () => {
  it('associates its label with the control it wraps', () => {
    render(
      <FilterField label="Tip">
        <select>
          <option>Amplasari</option>
        </select>
      </FilterField>,
    );

    // Found BY LABEL — the association is what a screen reader announces.
    expect(screen.getByLabelText('Tip')).toBeInstanceOf(HTMLSelectElement);
  });
});

describe('FilterBar', () => {
  it('renders whatever filters a screen puts in it', () => {
    render(
      <FilterBar>
        <SearchInput value="" onChange={() => {}} placeholder="Caută" />
        <FilterField label="Tip">
          <select />
        </FilterField>
      </FilterBar>,
    );

    expect(screen.getByRole('searchbox', { name: 'Caută' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tip')).toBeInTheDocument();
  });
});

describe('ErrorNotice', () => {
  it('shows the message with no retry button when the caller cannot retry', () => {
    render(<ErrorNotice message="Nu s-au putut încărca comenzile" />);

    expect(screen.getByText('Nu s-au putut încărca comenzile')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a Romanian retry button that calls onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorNotice message="Eroare de rețea" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Reîncearcă' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
