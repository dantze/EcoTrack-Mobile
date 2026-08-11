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
 * Mock is the default deliberately: the production backend is currently plain
 * HTTP on a bare IP, which a browser will refuse to call from an HTTPS origin
 * (mixed content). Live mode works from a local http://localhost dev server;
 * a deployed build needs TLS on the backend first.
 */

export type DataMode = 'mock' | 'live';

export const DATA_MODE: DataMode =
  (import.meta.env.VITE_DATA_MODE as DataMode | undefined) ?? 'mock';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://146.190.224.202:8080/api';

/**
 * Admin endpoints (/api/admin/**) require this shared secret in an
 * X-Admin-Key header. Absent it, those calls return 401.
 */
export const ADMIN_KEY: string | undefined = import.meta.env.VITE_ADMIN_KEY;

/** Artificial delay applied to mock responses, in ms, so loading states are real. */
export const MOCK_LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 220);

export const IS_MOCK = DATA_MODE === 'mock';
