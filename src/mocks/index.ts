/**
 * Mock implementation of EcoTrackApi, backed by a seeded in-memory store.
 *
 * TODO(api-agent): replace the stub with a real implementation:
 *   - seed.ts     deterministic Romanian-flavoured dataset (clients, orders,
 *                 routes, tasks, employees, products, subscriptions, recurring
 *                 plans) with realistic cross-references and coordinates
 *                 around Romanian counties
 *   - store.ts    mutable in-memory store; writes persist for the session
 *   - index.ts    EcoTrackApi implementation over the store, each call
 *                 delayed by MOCK_LATENCY_MS so loading states are exercised
 */

import type { EcoTrackApi } from '@/api/contract';
import { createStubApi } from '@/api/stub';

export const mockApi: EcoTrackApi = createStubApi('mock');
