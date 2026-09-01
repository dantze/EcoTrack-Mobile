/**
 * /login must not hold a live session hostage.
 *
 * EnrollmentPage is a route, so it can be opened with a session already in hand
 * — the address bar keeps /login after RequireAuth bounced someone there, and
 * mock mode enrolls itself on boot whichever URL was loaded. Before this guard,
 * `npm run dev` opened on /login rendered the "request access" form forever
 * while signed in as ADMIN: the session was fine, the screen just never got out
 * of the way.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth';
import { REFRESH_TOKEN_KEY } from '@/auth/storage';
import { EnrollmentPage } from '../EnrollmentPage';

const PENDING_TICKET_KEY = 'ecotrack.enrollmentTicket.v1';

function renderAt(entry: { pathname: string; state?: unknown }) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<EnrollmentPage />} />
          <Route path="/" element={<div>acasă</div>} />
          <Route path="/comenzi" element={<div>comenzi</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('EnrollmentPage with a live session', () => {
  beforeEach(() => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(PENDING_TICKET_KEY);
  });

  it('redirects away from /login instead of asking for access again', async () => {
    renderAt({ pathname: '/login' });

    await waitFor(() => expect(screen.getByText('acasă')).toBeInTheDocument());
    expect(screen.queryByLabelText('Nume complet')).not.toBeInTheDocument();
  });

  it('returns to the screen RequireAuth was bounced from', async () => {
    renderAt({ pathname: '/login', state: { from: { pathname: '/comenzi' } } });

    await waitFor(() => expect(screen.getByText('comenzi')).toBeInTheDocument());
  });

  it('drops a pending ticket the session made pointless', async () => {
    // A request this browser sent before getting in some other way. Nobody is
    // ever going to approve it, and leaving it stored means a later logout
    // reopens the waiting screen on a code no admin has been asked about.
    localStorage.setItem(
      PENDING_TICKET_KEY,
      JSON.stringify({
        requestId: 4242,
        claimSecret: 'stale',
        verificationCode: '123456',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      }),
    );

    renderAt({ pathname: '/login' });

    await waitFor(() => expect(screen.getByText('acasă')).toBeInTheDocument());
    expect(localStorage.getItem(PENDING_TICKET_KEY)).toBeNull();
  });
});
