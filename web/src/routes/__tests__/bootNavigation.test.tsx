/**
 * The reported bug, end to end: `npm run dev`, open /comenzi, get bounced to
 * /login a second later.
 *
 * Everything below the surface was fine — mock mode enrolls itself and the
 * session did arrive — but the dead refresh token from the previous page load
 * made `status` pass through 'anonymous' on the way there, and `RequireAuth`
 * turns that into a redirect that cannot be undone.
 *
 * So this mounts what main.tsx mounts (StrictMode, the real router, the real
 * AuthProvider) at the real URL, and asserts the URL is still the one that was
 * typed. A unit test on `status` cannot catch a bounce; only the router can.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/auth';
import { REFRESH_TOKEN_KEY } from '@/auth/storage';

async function boot(path: string) {
  window.history.pushState({}, '', path);
  // Imported after the URL is set: createBrowserRouter reads window.location
  // when the module is evaluated, not when it renders.
  const { router } = await import('@/routes/router');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

describe('booting straight onto a deep link', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stays on /comenzi when a dead refresh token is stored', async () => {
    // Exactly what a reload looks like in mock mode: the previous page load
    // persisted this, and the in-memory db that issued it no longer exists.
    localStorage.setItem(REFRESH_TOKEN_KEY, 'mock.refresh.999.from-a-previous-page-load');

    await boot('/comenzi');

    await waitFor(() => expect(screen.getByRole('heading', { name: /comenzi/i })).toBeVisible());
    expect(window.location.pathname).toBe('/comenzi');
    // The give-away of the old failure: the enrollment form, mid-boot.
    expect(screen.queryByLabelText('Nume complet')).not.toBeInTheDocument();
  });
});
