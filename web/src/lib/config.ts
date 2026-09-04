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
 * PRODUCTION build sets live mode explicitly: Terraform writes both
 * `VITE_DATA_MODE=live` and an absolute `VITE_API_BASE_URL` into the Vercel
 * project, and Vercel builds this bundle with them (`infra/main.tf`).
 *
 * That absolute URL is the difference from the deployment this replaced. A
 * single VPS ran Caddy in front of both, so `/api` was same-origin and CORS
 * never applied. Vercel and Cloud Run are two origins: every API call is
 * cross-origin, and it works only because the backend is given
 * `ECOTRACK_CORS_ALLOWED_ORIGINS` naming the Vercel domain. `docker compose`
 * still gives you the one-origin arrangement locally, which means **local
 * development cannot reproduce a CORS failure** — see DEPLOYMENT.md.
 */

export type DataMode = 'mock' | 'live';

export const DATA_MODE: DataMode =
  (import.meta.env.VITE_DATA_MODE as DataMode | undefined) ?? 'mock';

/**
 * Where the API lives. **Production always sets this explicitly** — Terraform
 * writes the Cloud Run URL into the Vercel project as `VITE_API_BASE_URL`, and
 * Vite inlines it at build time (see `infra/main.tf`).
 *
 * The fallback exists only for a live-mode build that forgot the variable, and
 * `/api` is chosen so that such a build fails against its OWN origin — a 404
 * from the site you are looking at, which points straight at the missing
 * variable. It used to default to `http://146.190.224.202:8080/api`, a
 * DigitalOcean droplet that no longer exists (TODO-75): a page served over
 * HTTPS would call it over plain HTTP, the browser would refuse it as mixed
 * content, and the operator would be left reading a stranger's IP in the
 * network tab.
 *
 * It is a fallback, not the deployment shape. The SPA and the API are on two
 * different origins now, so a relative path is never what production uses —
 * that is also why the backend needs `ECOTRACK_CORS_ALLOWED_ORIGINS`.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** Artificial delay applied to mock responses, in ms, so loading states are real. */
export const MOCK_LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 220);

export const IS_MOCK = DATA_MODE === 'mock';
