/**
 * Runtime configuration.
 *
 * The app runs in one of two data modes, chosen at build time by VITE_DATA_MODE:
 *
 *   mock (default) — no backend needed. All API calls resolve against an
 *                    in-memory seeded dataset with simulated latency. This is
 *                    how the UI is developed and demoed.
 *   live           — calls the real Spring backend at VITE_API_BASE_URL.
 *
 * Mock is the default for local development because it needs no backend. The
 * PRODUCTION build sets live mode explicitly (see web/Dockerfile), with a
 * relative VITE_API_BASE_URL=/api: Caddy serves this bundle and proxies /api to
 * the backend on the same domain, so the request is same-origin and neither
 * CORS nor mixed content applies.
 */

export type DataMode = 'mock' | 'live';

export const DATA_MODE: DataMode =
  (import.meta.env.VITE_DATA_MODE as DataMode | undefined) ?? 'mock';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://146.190.224.202:8080/api';

/** Artificial delay applied to mock responses, in ms, so loading states are real. */
export const MOCK_LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 220);

export const IS_MOCK = DATA_MODE === 'mock';
