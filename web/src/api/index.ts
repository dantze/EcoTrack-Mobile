/**
 * Resolves the active API implementation from the build-time data mode.
 *
 * Feature code imports ONLY from here:
 *     import { api } from '@/api';
 *     const clients = await api.clients.list();
 *
 * It must never import from `@/api/live` or `@/mocks` directly — that is what
 * keeps mock and live interchangeable.
 */

import { DATA_MODE, IS_MOCK } from '@/lib/config';
import type { EcoTrackApi } from './contract';
import { liveApi } from './live';
import { mockApi } from '@/mocks';

export const api: EcoTrackApi = IS_MOCK ? mockApi : liveApi;

export { DATA_MODE };
export * from './contract';
export { ApiError } from './http';

/**
 * Demo credentials for the seeded mock account, so LoginPage can hint them
 * without importing `@/mocks` directly. Only meaningful in mock mode.
 */
export { MOCK_CREDENTIALS_HINT, MOCK_AUTO_LOGIN, DEV_DEVICE_ID } from '@/mocks';
