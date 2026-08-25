/**
 * Autocomplete — the editable combobox behind the address fields.
 *
 * What is worth asserting is the contract a keyboard user depends on and that
 * a refactor can break without any type error: the list opens, ↑ ↓ move a
 * highlight, Enter commits the highlighted row, Escape closes the list without
 * losing what was typed, and Escape does NOT bubble out to close the drawer
 * the field lives in. Plus the Romanian requirement: typing "stefan" has to
 * offer "Str. Ștefan cel Mare".
 *
 * Free text is the other half of the contract — this is not a Select, and the
 * value must remain whatever the operator typed if they ignore the list.
 */

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Autocomplete, type AutocompleteOption } from '../Autocomplete';

const OPTIONS: AutocompleteOption[] = [
  { value: 'Str. Ștefan cel Mare nr. 1, Otopeni', hint: '3 comenzi', group: 'Adresele clientului' },
  { value: 'Bd. Unirii nr. 20, București', hint: '1 comandă', group: 'Adresele clientului' },
  { value: 'Str. Ștefan Vodă nr. 8, Buftea', hint: '2 comenzi', group: 'Alte adrese' },
];

function Harness({
  onSelect,
  initial = '',
}: {
  onSelect?: (option: AutocompleteOption) => void;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Autocomplete
      label="Adresă"
      value={value}
      onChange={setValue}
      onSelect={onSelect}
      options={OPTIONS}
    />
  );
}

const input = () => screen.getByLabelText('Adresă');

describe('Autocomplete', () => {
  it('offers the known addresses on focus', () => {
    render(<Harness />);
    fireEvent.focus(input());
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(input()).toHaveAttribute('aria-expanded', 'true');
  });

  it('finds a diacritic address from text typed without diacritics', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: 'stefan' } });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Ștefan');
    expect(screen.queryByText(/Unirii/)).not.toBeInTheDocument();
  });

  it('highlights the matched characters of the original string', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: 'stefan' } });
    expect(screen.getAllByRole('option')[0]!.querySelector('mark')).toHaveTextContent('Ștefan');
  });

  it('moves the highlight with the arrow keys and reports it to assistive tech', () => {
    render(<Harness />);
    fireEvent.focus(input());

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    expect(input().getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[0]!.id,
    );

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps around at both ends', () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('commits the highlighted suggestion on Enter', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.change(input(), { target: { value: 'stefan' } });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(input()).toHaveValue('Str. Ștefan cel Mare nr. 1, Otopeni');
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'Str. Ștefan cel Mare nr. 1, Otopeni' }),
    );
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('leaves Enter alone when nothing is highlighted, so the form can submit', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.change(input(), { target: { value: 'Adresă scrisă de mână' } });
    fireEvent.keyDown(input(), { key: 'Enter' });

    expect(onSelect).not.toHaveBeenCalled();
    expect(input()).toHaveValue('Adresă scrisă de mână');
  });

  it('commits on click too', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(input()).toHaveValue('Bd. Unirii nr. 20, București');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape, keeps the typed text, and does not bubble out of the field', () => {
    const onOuterEscape = vi.fn();
    render(
      <div onKeyDown={onOuterEscape}>
        <Harness />
      </div>,
    );
    fireEvent.change(input(), { target: { value: 'stefan' } });
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);

    fireEvent.keyDown(input(), { key: 'Escape' });

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(input()).toHaveValue('stefan');
    // The drawer or modal above must not close on the same keypress.
    expect(onOuterEscape).not.toHaveBeenCalled();
  });

  it('accepts free text that matches nothing at all', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: 'Loc complet nou' } });
    expect(input()).toHaveValue('Loc complet nou');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('does not offer a suggestion identical to what is already typed', () => {
    render(<Harness initial="Bd. Unirii nr. 20, București" />);
    fireEvent.focus(input());
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('keeps the caller’s group order rather than interleaving headings', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: 'stefan' } });
    const headings = screen
      .getAllByRole('listbox')[0]!
      .querySelectorAll('p');
    expect([...headings].map((node) => node.textContent)).toEqual([
      'Adresele clientului',
      'Alte adrese',
    ]);
  });

  it('exposes the error message to assistive tech', () => {
    render(
      <Autocomplete
        label="Adresă"
        value=""
        onChange={() => {}}
        options={OPTIONS}
        error="Selectați locația."
      />,
    );
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Selectați locația.');
  });
});
