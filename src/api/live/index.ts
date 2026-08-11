/**
 * Live backend implementation of EcoTrackApi.
 *
 * One module per Spring controller, composed here. Every path and request shape
 * was read off the Java source at Dami-Prod-EcoTrack/backend; where the wire
 * format and `@/types/domain` disagree, the reconciliation lives in
 * `normalize.ts` and is documented at the top of the module that hits the
 * endpoint.
 */

import type { EcoTrackApi } from '../contract';
import { authApi } from './auth';
import { clientsApi } from './clients';
import { employeesApi } from './employees';
import { ordersApi } from './orders';
import { productsApi } from './products';
import { recurringApi } from './recurring';
import { routesApi } from './routes';
import { subscriptionsApi } from './subscriptions';
import { tasksApi } from './tasks';

export const liveApi: EcoTrackApi = {
  auth: authApi,
  clients: clientsApi,
  orders: ordersApi,
  products: productsApi,
  subscriptions: subscriptionsApi,
  employees: employeesApi,
  routes: routesApi,
  tasks: tasksApi,
  recurring: recurringApi,
};
