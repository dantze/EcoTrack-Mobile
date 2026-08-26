import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthProvider';
import { REFRESH_TOKEN_KEY } from '../storage';

/**
 * Mock mode must sign itself in.
 *
 * There is no password anywhere in the system any more - access comes from an
 * admin approving a device - so a login screen in local development would be
 * asking for a credential that does not exist. `npm run dev` has to land in
 * the app, as the seeded ADMIN.
 */
function Probe() {
  const { status, user, hasRole } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.fullName ?? '-'}</span>
      <span data-testid="admin">{String(hasRole('ADMIN'))}</span>
      <span data-testid="sales">{String(hasRole('SALES'))}</span>
      <span data-testid="driver">{String(hasRole('DRIVER'))}</span>
    </div>
  );
}

describe('mock-mode auto login', () => {
  beforeEach(() => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  });

  it('boots straight into an authenticated ADMIN session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('admin')).toHaveTextContent('true');
  });

  it('lets the admin through every role gate', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    // ADMIN is a superset in SecurityConfig's matrix, so the sidebar must not
    // hide Vânzări/Tehnic from an account the server would let write there.
    expect(screen.getByTestId('sales')).toHaveTextContent('true');
    expect(screen.getByTestId('driver')).toHaveTextContent('true');
  });
});
