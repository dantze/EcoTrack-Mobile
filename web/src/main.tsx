import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/auth';
import { router } from '@/routes/router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Five minutes, not thirty seconds. Dispatchers move between Rute,
      // Sarcini and Hartă constantly, and every screen is a fresh mount — at
      // 30s almost every return trip re-fetched lists that had not changed and
      // flashed a loading state over data already on screen. The write paths
      // all invalidate explicitly, so freshness comes from mutations rather
      // than from re-asking on a timer.
      staleTime: 5 * 60_000,
      // Keep the cache well past staleTime so a revisit renders instantly from
      // cache and revalidates behind the existing content instead of blanking.
      gcTime: 30 * 60_000,
      // Alt-tabbing back to the browser is not a reason to re-query.
      refetchOnWindowFocus: false,
      // Nor is a mount, while the data is still inside staleTime.
      refetchOnMount: true,
      retry: 1,
    },
  },
});

// AuthProvider sits above the router (not inside a route element) so its
// session-restore effect starts as early as possible and RequireAuth, which
// lives inside the route tree, can read `status` from the very first route
// match — see src/auth/AuthProvider.tsx.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
