/**
 * Every screen boots.
 *
 * The rebuild onto shadcn/ui + Mantine moved every screen onto new primitives,
 * and the failure mode that survives a green type-check is a RUNTIME one: a
 * component rendered outside a provider it needs, a hook order that only
 * breaks on the second render, an import that resolves to `undefined` and
 * throws inside React rather than at build time. A unit test per screen would
 * not catch those either — several of them only happen inside the real router,
 * under the real shell, with the real provider stack.
 *
 * So this mounts what `main.tsx` mounts, once per route, and asserts two
 * things: the URL is still the one that was asked for (nothing bounced), and
 * the shell drew the screen's own heading. It is a smoke test on purpose —
 * behaviour belongs in the per-screen suites — but it is the one test that
 * fails when a whole screen stops rendering.
 *
 * Mock mode enrolls itself, so the account these routes are visited with holds
 * every role; that is what makes one loop cover both sections.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';

/** Path → a heading only that screen renders. */
const SCREENS: { path: string; heading: RegExp }[] = [
  { path: '/comenzi', heading: /^Comenzi$/ },
  { path: '/calendar', heading: /^Calendar$/ },
  { path: '/clienti', heading: /^Clienți$/ },
  { path: '/produse', heading: /^Produse$/ },
  { path: '/abonamente', heading: /^Abonamente$/ },
  { path: '/rute', heading: /^Rute$/ },
  { path: '/sarcini', heading: /^Sarcini$/ },
  { path: '/recurente', heading: /^Igienizări recurente$/ },
  { path: '/cereri', heading: /^Cereri de acces$/ },
  { path: '/angajati', heading: /^Angajați$/ },
];

async function boot(path: string) {
  window.history.pushState({}, '', path);
  // Imported after the URL is set: createBrowserRouter reads window.location
  // when the module is evaluated, not when it renders. `resetModules` in the
  // hook below is what lets each iteration get a router at its own URL.
  // Both imported here, after `resetModules`: a statically imported
  // `AuthProvider` would be the PREVIOUS module instance, and the router's
  // `RequireAuth` — freshly imported — would then read a different React
  // context and bounce every route to /login.
  const { router } = await import('@/routes/router');
  const { AuthProvider } = await import('@/auth');
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

describe('every screen boots under the real shell', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    // React reports a render-phase throw here before the error boundary sees
    // it, so this is where a screen that crashed but recovered shows up.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it.each(SCREENS)('renders $path', async ({ path, heading }) => {
    await boot(path);

    await waitFor(
      () => expect(screen.getByRole('heading', { name: heading })).toBeVisible(),
      { timeout: 4000 },
    );
    expect(window.location.pathname).toBe(path);

    // The error page renders instead of the screen when a render throws, so
    // its copy is the sharpest signal that something below the router failed.
    expect(screen.queryByText(/Ceva nu a mers/i)).not.toBeInTheDocument();
  });
});
