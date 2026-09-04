/**
 * `SegmentedControl` / `MultiToggle` (TODO-58).
 *
 * The behaviour worth pinning is the difference between them, which is one
 * line of code and easy to lose: a segmented control must always have an
 * answer, a multi-toggle may have none. Radix's single-select toggle group is
 * deselectable by default, so "click the active option again" is the case that
 * decides whether this component is correct.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiToggle, SegmentedControl } from '../Toggles';

const TYPES = [
  { value: 'Amplasari', label: 'Amplasări' },
  { value: 'Ridicari', label: 'Ridicări' },
] as const;

describe('SegmentedControl', () => {
  it('reports the option the user picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Tip comandă"
        value="Amplasari"
        onChange={onChange}
        options={[...TYPES]}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Ridicări' }));

    expect(onChange).toHaveBeenCalledWith('Ridicari');
  });

  it('ignores a click on the option that is already selected', async () => {
    // Radix fires onValueChange('') here. Passed through, the order type would
    // become empty — a state the form's validator does not model and the
    // subtype fields cannot render.
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Tip comandă"
        value="Amplasari"
        onChange={onChange}
        options={[...TYPES]}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Amplasări' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('tells assistive tech which option is current', () => {
    render(
      <SegmentedControl
        aria-label="Tip comandă"
        value="Ridicari"
        onChange={vi.fn()}
        options={[...TYPES]}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Ridicări' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Amplasări' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radiogroup', { name: 'Tip comandă' })).toBeInTheDocument();
  });
});

describe('MultiToggle', () => {
  it('allows the empty selection that SegmentedControl refuses', async () => {
    // No layers is a valid map. This is the whole reason the two components
    // are not one component with a flag.
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultiToggle
        aria-label="Straturi hartă"
        value={['heatmap']}
        onChange={onChange}
        options={[{ value: 'heatmap', label: 'Densitate' }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Densitate' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
