/**
 * Route table.
 *
 * Owned by the shell, not by the feature agents — they add screens by
 * exporting page components, and those get wired up here.
 *
 * Shape, outside in:
 *   /login is the only public route.
 *   `RequireAuth` gates everything else on a live session (see src/auth) —
 *     anonymous or still-restoring visitors never reach AppShell.
 *   `RequireRole` gates the Vânzări routes on SALES and the Tehnic routes on
 *     TECH, matching the two nav sections in AppShell — a Sales-only account
 *     hitting /rute directly gets the Romanian "acces interzis" page, not a
 *     blank screen or a silent redirect.
 *   The index route sends a signed-in user to whichever section their roles
 *     actually grant, so landing on "/" never bounces through Forbidden.
 *   A catch-all under AppShell renders NotFoundPage for anything else, and
 *     the root `errorElement` catches any render throw below it.
 *
 * The eight feature screens are loaded with React Router's own `lazy`, so each
 * becomes its own chunk instead of riding in the entry bundle. That matters
 * here for two reasons: nobody has both role sets in practice, so a dispatcher
 * was downloading the whole Vânzări module (and vice versa) to look at a route;
 * and @dnd-kit is used by exactly one screen, RoutesPage, so it now travels
 * with it. `lazy` rather than React.lazy + Suspense because the router already
 * has a pending state — the current screen stays on-screen during the fetch
 * instead of blanking to a spinner.
 *
 * The auth screens stay eager on purpose: LoginPage is the first thing an
 * anonymous visitor needs, and making it a second round trip would put a
 * network hop on the critical path to the login form.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, RequireRole, useAuth } from '@/auth';
import { ForbiddenPage } from '@/features/auth/ForbiddenPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { NotFoundPage } from '@/features/auth/NotFoundPage';
import { ErrorPage } from './ErrorPage';

/**
 * Turns a named export from a lazily imported module into the `{ Component }`
 * shape React Router's `lazy` expects. Keeps the route table readable.
 */
function lazyPage(load: () => Promise<Record<string, unknown>>, name: string) {
  return async () => ({ Component: (await load())[name] as React.ComponentType });
}

/** Sends a signed-in user to the first section their roles actually grant. */
function HomeRedirect() {
  const { hasRole } = useAuth();
  if (hasRole('SALES')) return <Navigate to="/comenzi" replace />;
  if (hasRole('TECH')) return <Navigate to="/rute" replace />;
  return <ForbiddenPage />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    errorElement: <ErrorPage />,
    children: [
      { path: 'login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomeRedirect /> },
              {
                // Cross-module: the map plots Vânzări orders and draws Tehnic
                // routes over them, so either role opens it and the screen
                // itself decides which layers that role gets.
                element: <RequireRole roles={['SALES', 'TECH']} />,
                children: [
                  {
                    path: 'harta',
                    lazy: lazyPage(() => import('@/features/map/MapPage'), 'MapPage'),
                  },
                ],
              },
              {
                element: <RequireRole roles={['SALES']} />,
                children: [
                  {
                    path: 'comenzi',
                    lazy: lazyPage(() => import('@/features/sales/OrdersPage'), 'OrdersPage'),
                  },
                  {
                    path: 'clienti',
                    lazy: lazyPage(() => import('@/features/sales/ClientsPage'), 'ClientsPage'),
                  },
                  {
                    path: 'produse',
                    lazy: lazyPage(() => import('@/features/sales/ProductsPage'), 'ProductsPage'),
                  },
                  {
                    path: 'abonamente',
                    lazy: lazyPage(
                      () => import('@/features/sales/SubscriptionsPage'),
                      'SubscriptionsPage',
                    ),
                  },
                ],
              },
              {
                element: <RequireRole roles={['TECH']} />,
                children: [
                  {
                    path: 'rute',
                    lazy: lazyPage(() => import('@/features/technical/RoutesPage'), 'RoutesPage'),
                  },
                  {
                    path: 'sarcini',
                    lazy: lazyPage(() => import('@/features/technical/TasksPage'), 'TasksPage'),
                  },
                  {
                    path: 'soferi',
                    lazy: lazyPage(() => import('@/features/technical/DriversPage'), 'DriversPage'),
                  },
                  {
                    path: 'recurente',
                    lazy: lazyPage(
                      () => import('@/features/technical/RecurringPage'),
                      'RecurringPage',
                    ),
                  },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
