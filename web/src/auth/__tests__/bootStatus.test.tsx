/**
 * Boot may answer "anonymous" only once, and only at the end.
 *
 * `RequireAuth` redirects to /login the instant it sees that status, and a
 * redirect is not retractable — the URL is rewritten and the user is sitting on
 * the enrollment screen. So a transient anonymous DURING boot is as bad as a
 * permanent one, even though the session arrives a few hundred ms later.
 *
 * That is exactly what the mock reload path did: the dead refresh token left
 * over from the previous page load failed to refresh, `localLogout` announced
 * anonymous, and re-enrollment only succeeded afterwards. `npm run dev` opened
 * on /comenzi, showed it for a beat, and bounced to /login.
 *
 * These run under StrictMode on purpose. The browser mounts the app that way,
 * which runs the boot effect twice, and that double run is why the plain render
 * in mockAutoLogin.test.tsx did not see this.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthProvider';
import { REFRESH_TOKEN_KEY } from '../storage';

/** Every distinct status this render ever passed through, in order. */
const seen: string[] = [];

function Probe() {
  const { status } = useAuth();
  if (seen[seen.length - 1] !== status) seen.push(status);
  return <span data-testid="status">{status}</span>;
}

function bootStrict() {
  seen.length = 0;
  return render(
    <StrictMode>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </StrictMode>,
  );
}

async function settle() {
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
}

describe('mock-mode boot never flashes anonymous', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('goes loading -> authenticated on a first visit', async () => {
    bootStrict();
    await settle();
    expect(seen).toEqual(['loading', 'authenticated']);
  });

  it('goes loading -> authenticated on a reload, with a dead token stored', async () => {
    // What every reload looks like in mock mode: the token was persisted by the
    // previous page load and the in-memory db that issued it is gone.
    localStorage.setItem(REFRESH_TOKEN_KEY, 'mock.refresh.999.from-a-previous-page-load');

    bootStrict();
    await settle();
    expect(seen).toEqual(['loading', 'authenticated']);
    expect(seen).not.toContain('anonymous');
  });
});
