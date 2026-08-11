/**
 * Route table.
 *
 * Owned by the shell, not by the feature agents — they add screens by
 * exporting page components, and those get wired up here.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ClientsPage } from '@/features/sales/ClientsPage';
import { OrdersPage } from '@/features/sales/OrdersPage';
import { ProductsPage } from '@/features/sales/ProductsPage';
import { SubscriptionsPage } from '@/features/sales/SubscriptionsPage';
import { DriversPage } from '@/features/technical/DriversPage';
import { RecurringPage } from '@/features/technical/RecurringPage';
import { RoutesPage } from '@/features/technical/RoutesPage';
import { TasksPage } from '@/features/technical/TasksPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/comenzi" replace /> },
      { path: 'comenzi', element: <OrdersPage /> },
      { path: 'clienti', element: <ClientsPage /> },
      { path: 'produse', element: <ProductsPage /> },
      { path: 'abonamente', element: <SubscriptionsPage /> },
      { path: 'rute', element: <RoutesPage /> },
      { path: 'sarcini', element: <TasksPage /> },
      { path: 'soferi', element: <DriversPage /> },
      { path: 'recurente', element: <RecurringPage /> },
    ],
  },
]);
