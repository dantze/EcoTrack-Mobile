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
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, RequireRole, useAuth } from '@/auth';
import { ForbiddenPage } from '@/features/auth/ForbiddenPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { NotFoundPage } from '@/features/auth/NotFoundPage';
import { ClientsPage } from '@/features/sales/ClientsPage';
import { OrdersPage } from '@/features/sales/OrdersPage';
import { ProductsPage } from '@/features/sales/ProductsPage';
import { SubscriptionsPage } from '@/features/sales/SubscriptionsPage';
import { DriversPage } from '@/features/technical/DriversPage';
import { RecurringPage } from '@/features/technical/RecurringPage';
import { RoutesPage } from '@/features/technical/RoutesPage';
import { TasksPage } from '@/features/technical/TasksPage';
import { ErrorPage } from './ErrorPage';

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
                element: <RequireRole roles={['SALES']} />,
                children: [
                  { path: 'comenzi', element: <OrdersPage /> },
                  { path: 'clienti', element: <ClientsPage /> },
                  { path: 'produse', element: <ProductsPage /> },
                  { path: 'abonamente', element: <SubscriptionsPage /> },
                ],
              },
              {
                element: <RequireRole roles={['TECH']} />,
                children: [
                  { path: 'rute', element: <RoutesPage /> },
                  { path: 'sarcini', element: <TasksPage /> },
                  { path: 'soferi', element: <DriversPage /> },
                  { path: 'recurente', element: <RecurringPage /> },
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
