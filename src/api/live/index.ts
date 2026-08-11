/**
 * Live backend implementation of EcoTrackApi.
 *
 * TODO(api-agent): replace the stub with real clients, one module per
 * controller (auth.ts, clients.ts, orders.ts, products.ts, subscriptions.ts,
 * employees.ts, routes.ts, tasks.ts, recurring.ts), each using `request()`
 * from '../http', then compose them here.
 */

import type { EcoTrackApi } from '../contract';
import { createStubApi } from '../stub';

export const liveApi: EcoTrackApi = createStubApi('live');
