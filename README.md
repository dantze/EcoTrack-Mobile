# EcoTrack Web

Desktop web rewrite of the EcoTrack field-operations app (Dami Prod). Replaces
the Expo/React Native UI for the **Sales** and **Technical** roles with a plain
React app designed for large screens. The Driver role stays on the native app —
it is in-truck work that needs a real camera and GPS.

Backend is unchanged: the existing Spring service at `Dami-Prod-EcoTrack/backend`.

## Stack

| Concern | Choice |
| --- | --- |
| Build | Vite 6 |
| UI | React 19, plain function components |
| Routing | React Router 7 |
| Server state | TanStack Query 5 |
| Styling | Tailwind CSS 4 (CSS-first tokens in `src/index.css`) |
| Language | TypeScript, strict |

## Running it

```bash
npm install
npm run dev      # http://localhost:5173, mock data, no backend needed
```

The app defaults to **mock mode** — a seeded in-memory dataset, no network. To
point it at the real backend:

```bash
echo "VITE_DATA_MODE=live" > .env.local
npm run dev
```

Note that live mode only works from an `http://localhost` origin today. The
production backend is plain HTTP on a bare IP, and a browser refuses HTTP calls
from an HTTPS page (mixed content), so a deployed build needs TLS on the
backend first.

## Architecture

```
src/
  types/domain.ts        Domain model mirroring the Java entities. THE contract.
  api/
    contract.ts          EcoTrackApi — the interface both impls satisfy
    http.ts              fetch wrapper for the live backend
    live/                real implementation (one module per controller)
    index.ts             resolves mock vs live from VITE_DATA_MODE
  mocks/                 seeded in-memory implementation of the same interface
  components/
    ui/                  design-system primitives (types.ts is a frozen contract)
    domain.tsx           shared Romanian enum labels + formatting
    layout/AppShell.tsx  sidebar + content shell
  features/
    sales/               orders, clients, products, subscriptions
    technical/           routes, tasks, drivers, recurring sanitation
  routes/router.tsx      route table
```

Two rules keep the modules independent:

1. Feature code imports `api` from `@/api` only — never from `@/api/live` or
   `@/mocks`. That is what makes the two modes interchangeable.
2. Backend enum labels and shared formatting live in `src/components/domain.tsx`.
   Do not re-translate `TaskStatus` locally.

## Backend contract notes

Read off the controllers, not inferred. The non-obvious ones:

- `Client` and `Order` are Jackson-polymorphic. The wire format carries a
  discriminator: `Client.type` is `individual|company`, `Order.orderType` is
  `Amplasari|Ridicari|Igienizari`.
- `PUT /routes/{id}/reorder-tasks` takes a **bare JSON array** of task ids.
- `GET /tasks/order/{orderId}/exists` returns an **object**
  (`{hasTask, taskId, routeId, scheduledTime, status}`), not a boolean.
- `PATCH /tasks/{id}/scheduled-date` takes `{scheduledDate}` and the server
  pins the time to 08:00 on that date.
- `POST /tasks/{id}/photos` is multipart with a repeated field named `files`.
- `/api/admin/**` requires an `X-Admin-Key` header.
- Coordinates are stored as `"lat,lng"` strings. Use `parseCoordinates()`.

## Known gaps

- **Auth is weak by design in the backend.** Login returns a user object with
  no token, so the session is just a localStorage record. On the web that means
  a user can grant themselves a role via devtools. Worth fixing server-side
  before this is exposed publicly.
