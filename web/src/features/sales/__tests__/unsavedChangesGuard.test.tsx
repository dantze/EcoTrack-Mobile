/**
 * The unsaved-changes guard on the form drawers (TODO-58).
 *
 * What is worth testing is the DECISION, not the dialog's styling: closing a
 * form that was touched must ask, and closing one that was not must be silent.
 * Both halves matter and only one of them is obvious — a guard that asks every
 * time is quickly trained away, at which point it stops being a guard.
 *
 * `ClientFormDrawer` is the subject because it is the smaller of the two
 * drawers and shares the guard with `OrderFormDrawer` — the hook and the
 * baseline-snapshot arrangement are identical.
 */

import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientFormDrawer } from '../components/ClientFormDrawer';

function renderDrawer(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ClientFormDrawer onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

const cancelButton = () => screen.getByRole('button', { name: 'Anulează' });

describe('closing a form drawer', () => {
  it('closes without asking when nothing was typed', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    await user.click(cancelButton());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks before discarding work, and does not close while the question is open', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    await user.type(screen.getByLabelText(/nume/i), 'Ionescu');
    await user.click(cancelButton());

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    // The whole point: the drawer is still open and the work still exists.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the form when the operator chooses to continue editing', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    const nameField = screen.getByLabelText(/nume/i);
    await user.type(nameField, 'Ionescu');
    await user.click(cancelButton());

    await user.click(await screen.findByRole('button', { name: 'Continuă editarea' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(nameField).toHaveValue('Ionescu');
  });

  it('closes once the operator confirms the discard', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    await user.type(screen.getByLabelText(/nume/i), 'Ionescu');
    await user.click(cancelButton());
    await user.click(await screen.findByRole('button', { name: 'Renunță la modificări' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('guards Escape too, not only the Anulează button', async () => {
    // Escape and the backdrop both reach the drawer's own onClose, which is a
    // different path from the footer button — and the easier one to lose work
    // to, because it is a slip rather than a decision.
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    await user.type(screen.getByLabelText(/nume/i), 'Ionescu');
    await user.keyboard('{Escape}');

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('treats typing and then undoing it as unchanged', async () => {
    // The baseline is a snapshot compare, not a "was touched" flag, so
    // returning a field to how it started is genuinely not a change.
    const user = userEvent.setup();
    const { onClose } = renderDrawer();

    const nameField = screen.getByLabelText(/nume/i);
    await user.type(nameField, 'Ionescu');
    await user.clear(nameField);
    await user.click(cancelButton());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
