/**
 * The kit's date field.
 *
 * Found by driving the real app against the real backend: clicking a day in the
 * calendar did nothing in every drawer and dialog in the app, so an order could
 * not be saved at all — the field stayed empty and the form answered
 * "Selectați perioada de amplasare". Typing a date worked, which is what made
 * it read as a mystery rather than a broken control.
 *
 * The cause was not in this component's logic but in where its dropdown was
 * mounted. The kit's Drawer/Modal are Radix `Sheet`/`Dialog` in modal mode, and
 * Radix enforces modality by setting `pointer-events: none` on <body> while one
 * is open — only its own subtree stays interactive. `withinPortal` mounted the
 * calendar on <body>, OUTSIDE that subtree, so every day cell inherited
 * `pointer-events: none`; the click sailed through to the backdrop, which
 * dismissed the popover without selecting anything.
 *
 * **jsdom cannot reproduce that.** It has no layout and does not enforce
 * `pointer-events`, and Mantine's popover does not even open there. So the
 * guard below is deliberately a source-level tripwire rather than a click
 * simulation that would pass for the wrong reason.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/theme/AppProviders';
import { DateInput } from '../DateInput';

describe('DateInput', () => {
  it('parses a typed Romanian date into the ISO string the app stores', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AppProviders>
        <DateInput label="Dată început" value={null} onChange={onChange} />
      </AppProviders>,
    );

    const field = screen.getByLabelText('Dată început');
    await user.click(field);
    await user.type(field, '15.03.2026');
    await user.tab();

    // The kit's contract is an ISO string in, an ISO string out — no Date
    // object ever crosses this boundary.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('2026-03-15'));
  });

  it('does not portal its calendar out of the dialog that contains it', () => {
    const source = readFileSync('src/components/ui/DateInput.tsx', 'utf8');

    // `withinPortal: true` is what broke every date field inside a drawer. If
    // this ever needs to change, the calendar has to be portalled INTO the
    // dialog's own container, not onto <body> — see the file header.
    expect(source).toMatch(/withinPortal:\s*false/);
    expect(source).not.toMatch(/withinPortal:\s*true/);
  });
});
