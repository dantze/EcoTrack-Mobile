# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

A monorepo with three independently deployed projects. There is no workspace
tool — each has its own dependencies and is built from its own directory.

| Dir | Stack | Deploy |
|---|---|---|
| `backend/` | Spring Boot 3.5, Java 21, Gradle, JPA | `deploy.yml` → SSH to a VPS, docker compose |
| `web/` | React 19, Vite 6, Tailwind 4, TanStack Query, React Router 7 | `deploy.yml` — same stack, same domain as the backend |
| `mobile/` | Expo ~54 / React Native 0.81, expo-router | `deploy-mobile.yml` → EAS Update (OTA) / EAS Build |

**See `DEPLOYMENT.md`** for triggers, required secrets and the runbook. The
backend and web deploy together because Caddy serves both from one domain.

CI is split into `ci-backend.yml` / `ci-web.yml` / `ci-mobile.yml`, each filtered
on its own `paths:`. Keep that filtering when adding workflows — it is the reason
three projects can share one repo. `repo-hygiene.yml` has **no** `paths:` filter
on purpose and runs on every PR; it is the only check that covers files no
project workflow watches. `audit.yml` is scheduled, not a PR gate. See the
`verify` skill for which checks a given diff actually needs.

## Commands

Always run these from the project subdirectory, not the repo root.

```bash
# backend
cd backend
./gradlew build                  # compile + run all tests
./gradlew test
./gradlew test --tests "*TokenServiceTest"                 # one class
./gradlew test --tests "*OrderServiceTest.createOrder_shouldThrowWhenClientNotFound"
./gradlew bootRun                # H2 file DB
./gradlew bootRun --args='--spring.profiles.active=dev'    # same H2 DB

# docker (full stack: postgres + backend + web + caddy with auto HTTPS)
docker compose up -d --build
docker compose logs -f backend
docker compose down

# web
cd web
npm install
npm run dev        # http://localhost:5173, mock data by default
npm run lint
npm run typecheck
npm run test:run
npm run build

# mobile
cd mobile
npm install
npm start
npm run android
npm run lint
npm run typecheck
npm run test:run
```

`bootRun` auto-loads `backend/.env` via a custom task in `build.gradle`.

**All three projects have tests** — backend JUnit through Gradle, `web` and
`mobile` Vitest. `npm run test` is watch mode and never exits; CI (and you) want
`npm run test:run`.

## Auth: how anyone gets in

**There is no password login and no Google sign-in.** `/api/auth/login` and
`/api/auth/google` are gone, and `Employee` has no credential to authenticate
with. **Device enrollment is the only way to obtain a session:**
`POST /api/enrollment/request` (full name + device id) answers with a 6-digit
code, an ADMIN approves the request under `/api/admin/enrollment/**`, and
`POST /api/enrollment/claim` then issues the token pair. The first request
against an empty database is auto-approved as ADMIN — gated by a one-time setup
code logged at startup while `ecotrack.enrollment.require-setup-code=true` — so
whoever opens a fresh server owns it permanently, with no password path back in.

What survives under `/api/auth`: `refresh`, `logout`, `me`, `sessions`,
`DELETE /sessions/{id}`, `DELETE /sessions`.

**Tokens are opaque, not JWTs.** `TokenService` mints 32 bytes from
`SecureRandom` and persists only the SHA-256 hash, in `Session`. 30-minute
access token, 365-day refresh token that **rotates on every use**, revocable per
device. Above `max-sessions-per-user` an employee's least-recently-used sessions
are revoked when a new one is issued, and unusable sessions are pruned nightly.
Every lifetime, the session cap and the enrollment rate limit are
`ecotrack.security.*` / `ecotrack.enrollment.*` properties in
`application.properties` — read them there rather than hardcoding a number.

**All three projects can now get a session** (TODO-19). `web/` has
`features/auth/EnrollmentPage.tsx`; `mobile/` has `app/enrollment.tsx` plus
`services/EnrollmentService.ts`, and its password login is deleted. Token
plumbing is shared in spirit across both: `services/tokenStore.ts` holds the
pair and `services/http.ts` attaches `Authorization` and does a single-flight
refresh-and-retry on one 401.

**One rule the enrollment screens depend on:**
`BearerTokenAuthenticationFilter` rejects any request carrying a token it cannot
validate, and it runs BEFORE authorization — so it fires on the `permitAll`
enrollment endpoints too. A device whose session was revoked still holds that
dead token, which would make the one screen able to recover the device the one
screen it cannot reach. Mobile's `apiFetch` therefore takes
`{ anonymous: true }`, and all three enrollment calls use it; a test asserts it.
**A new unauthenticated endpoint needs the same treatment.**

## The security enforcement flag

`ecotrack.security.enforce` gates whether `/api/**` rejects unauthenticated
requests. It does **not** gate the auth machinery — enrollment, refresh, logout
and bearer validation always work, and `BearerTokenAuthenticationFilter` always
populates the SecurityContext for callers that do send a valid token.

| Where | Value | Why |
|---|---|---|
| `application.properties` (base, inherited by prod) | `${ECOTRACK_SECURITY_ENFORCE:true}` | **on by default.** No token-less client is left to protect: the only way to a session is enrollment, and enrollment issues tokens |
| `application-dev.properties`, `application-test.properties` | `true` | local runs and `@SpringBootTest` exercise the real behaviour |
| `SecurityConfig`'s `@Value` fallback | `false` | applies only if the property is absent entirely — never in a normal boot |

Setting `ECOTRACK_SECURITY_ENFORCE=false` in the environment is a deliberate
escape hatch that opens `/api/**` to anonymous callers. It is not a default and
should not be committed anywhere.

Two companion knobs sit next to it, both **independent of `enforce`**:

- `ecotrack.security.reject-invalid-bearer` (default `true`) — a request whose
  Bearer token is unknown, expired or revoked gets a 401 even while `enforce` is
  `false`. Requests with **no** `Authorization` header are untouched, which is
  what keeps the public enrollment endpoints reachable. Without it, a revoked
  token would keep working through an open gate and logout would be invisible to
  the client.
- The **role matrix** in `SecurityConfig`, written inside the `enforceSecurity`
  branch and therefore completely inert while `enforce=false`. **First match
  wins, so position is the whole game.** In order: infrastructure paths
  (`denyAll`) and the health probe; the only unauthenticated surface —
  `GET /api/enrollment/status`, `POST /api/enrollment/request` and `/claim`,
  `POST /api/auth/refresh` and `/logout` — then the rest of `/api/auth/**`
  authenticated; `/api/admin/**` and employee writes need `ADMIN`;
  `PATCH /api/tasks/*/status` and `POST /api/tasks/*/photos` accept
  `DRIVER`/`SALES`/`TECH`/`ADMIN` (those two are the only writes the driver app
  makes — **a new mobile write needs a new row, above the catch-alls**); other
  `/api/**` writes need `SALES`/`TECH`/`ADMIN`; `/api/**` reads need any
  authenticated employee; everything else is `denyAll()`.
  Authentication alone is not authorization: before this matrix existed, any
  valid token was effectively an admin token.

`SecurityTests/` covers both modes: `AuthEnforcementOnTest`,
`AuthEnforcementOffTest`, `AuthorizationMatrixTest`, `TaskScopingTest`,
`EnrollmentFlowTest`, `EnrollmentBootstrapCodeTest`. The `auth-security` skill
walks the whole surface; `api-endpoint` covers adding a route to it.

### Row-level task access is a separate layer

The role matrix answers "which VERBS may this role use". It does not answer
"which ROWS" — and those are different questions. `TaskAccessPolicy`
(`service/TaskAccessPolicy.java`) is the second layer, consulted by
`TaskController`:

- A **driver-only** employee (holds `DRIVER` and no office role) may read and
  write exactly the tasks on routes assigned to them. Assignment runs
  `Task -> Route -> Employee`; a route has one assignee.
- **Office staff** (`ADMIN`/`SALES`/`TECH`) are unrestricted — the overview is
  unchanged. Someone holding `DRIVER` *and* an office role counts as office.
- `GET /api/tasks/mine` and `/api/tasks/mine/date/{date}` take the employee from
  the access token. **The driver app must use these** — passing an id from the
  client is what allowed one driver to read another's day.
- `/api/tasks/employee/{id}` still exists for the office overview (and for
  `Technical/ChangeDriver`), and returns 403 when a driver asks for an id that
  is not their own.

`SecurityTests/TaskScopingTest` covers this against the real filter chain.
**A new task endpoint needs a policy call, not just a matcher row.**

### Controller slices prove nothing about auth

`@WebMvcTest` does not pick up the app's own `SecurityConfig`, and the slices in
`ControllerTests/` run `@AutoConfigureMockMvc(addFilters = false)` with
`TaskAccessPolicy` as a `@MockitoBean` whose void guards no-op. A green
controller slice says the wiring works and nothing at all about who may call it.
Security assertions belong in the `@SpringBootTest` classes under
`SecurityTests/`, which run the real chain.

## Backend architecture

Standard controller → service → repository layering under
`com.example.damiProd`. The parts that need multiple files to understand:

**Domain inheritance.** `Order` and `Client` both use JPA
`InheritanceType.JOINED`. `Order` → `AmplasareOrder` / `RidicareOrder` /
`IgienizareOrder`, dispatched by Jackson `@JsonSubTypes` on an `orderType`
discriminator. `Client` → `Individual` / `Company`. Adding an order type spans
all three projects at once — use the `order-type` skill.
`OrderService.createOrder`/`updateOrder` are `@Transactional`, because task
generation and inventory adjustment happen inside them.

**`Task` has three independent parents** — `route_id`, `order_id`, and
`recurring_plan_id`, each nullable and meaning something different. Tasks are
generated from orders and from `RecurringIgienizare` plans; `RecurringTaskScheduler`
tops up indefinite plans nightly at 02:00.

**CORS lives in `SecurityConfig`, not `WebConfig`.** `WebConfig` is a
deliberately empty marker documenting why — Spring Security must own CORS once
it is on the classpath, and a second registration would double-add headers.

**Profiles.** Base and `dev` both use the H2 file DB at `backend/data/damiprod`;
`dev` overrides nothing that matters any more. `prod` switches to Postgres,
building its JDBC URL from `DB_HOST`/`DB_PORT`/`DB_NAME` env vars. `test` =
in-memory H2, `create-drop`, `DataLoader` disabled.
`DataLoader` seeds the role rows and the product catalogue, and only when those
tables are empty. It no longer seeds employees — the first enrolled device
becomes the first ADMIN instead.

## Two definitions of "done", on purpose

An order's "is the work finished?" question has **two** answers in this repo and
they deliberately disagree. Picking the wrong one is a silent bug, so pick
consciously.

**The strict rule — `isOrderFulfilled` in `web/src/features/sales/orderModel.ts`:
an order is finished iff it has a COMPLETED task, and nothing else.** An order
with no task has certainly not been carried out, so it stays current even when
its date is long past. A status that is missing or still loading also reads as
unfinished — an order only leaves the operator's list on positive evidence.

The backend enforces the **same** rule in
`OrderRepository.findLiveBySubscriptionId`, whose JPQL is a
`NOT EXISTS (… task.status = 'COMPLETED')`: that is what refuses to retire a
subscription while live orders still point at it. Two implementations, one rule
— **change one and you must change the other**, or the archive and the guard
will disagree about the same order.

This strict rule drives the **Curente / Arhivă** split on Comenzi. Nothing
archives or un-archives by hand: the state is derived, so an order leaves Arhivă
exactly when its task stops being COMPLETED.

**The lenient rule — `deriveLifecycle` in `web/src/features/map/data.ts`:** task
evidence first, then a **fallback to date reasoning** when an order has no
conclusive task, which will call a task-less past-dated order `'done'`. That is
fine for colouring a map pin and wrong for a guard or an archive, which have to
fail safe. Do not "unify" the two, and do not reach for `deriveLifecycle` when
the answer gates a write or hides a row.

A third, unrelated definition: the Comenzi table, the calendar and the day
drawer all place an order on **`orderPrimaryDate`** (start / pickup / sanitation
date) — one shared definition of *when*, so the table and the calendar can never
disagree about which day an order belongs to.

## Web architecture

**The data layer has two interchangeable implementations behind one contract.**
`src/api/contract.ts` defines `EcoTrackApi`; both `src/api/live/` (real fetch)
and `src/mocks/` (seeded in-memory store) satisfy it exactly. `src/api/index.ts`
picks one from `VITE_DATA_MODE` at build time.

Feature code must import only `{ api } from '@/api'` — never from `@/api/live`
or `@/mocks` directly. That rule is the only thing keeping the two implementations
substitutable. The `web-data-layer` skill has the full procedure.

Mock is the default for local development, where it needs no backend at all.
**Production builds live mode.** `web/Dockerfile` defaults to
`VITE_DATA_MODE=live` with a RELATIVE `VITE_API_BASE_URL=/api`: Caddy serves the
SPA and proxies `/api` to the backend on the same domain, so the call is
same-origin. That is what retired the old mixed-content blocker — the backend is
no longer plain HTTP on a bare IP.

**`src/api/live/normalize.ts` absorbs the wire/domain mismatch.** The Spring
entities do not serialise cleanly into `@/types/domain`: associations are
`@JsonIgnore`d and replaced by transient id/name getters, and `/api/employees`
returns the JPA entity (roles as objects) while `/api/admin/employees` returns a
DTO (roles as strings). **If you change an entity's JSON shape in the backend,
`normalize.ts` is where the web app breaks.**

**`src/auth/tokenBridge.ts` is an acyclic seam,** not incidental indirection.
`http.ts` needs the current access token and a refresh-on-401 hook, but cannot
import `src/auth` because `AuthProvider` imports `@/api`. `AuthProvider`
registers its token and refresher into the bridge on mount. The access token is
held in memory only; only the refresh token (and the generated device id)
survive a reload, in versioned `localStorage` keys.

A 401 from anything other than `/auth/**` triggers exactly one silent
refresh-and-retry.

**Third-party map calls bypass `@/api` on purpose.** Map tiles come from
OpenFreeMap (`MAP_STYLE_URL` in `features/map/components/mapStyle.ts`) and
address search/reverse geocoding from Photon (`src/lib/geocoding.ts`); neither
is keyed, and neither goes through `http.ts`, because that would attach our
bearer token to someone else's host. Same rule and same reason as
`LocationPicker` in `mobile/` (Google Places). MapLibre is ~250 kB gzipped, so
everything that imports it must stay behind a dynamic import — `/harta` via the
route table, the order location picker via `React.lazy` in
`sales/components/fields.tsx`.

**A MapLibre container must be positioned with INLINE styles.** MapLibre stamps
`.maplibregl-map` onto the element it is given, and `maplibre-gl.css` sets
`position: relative` on that class — loaded after Tailwind's utilities, so it
beats `absolute inset-0`, the container collapses to height 0, and the map
renders a blank white box while still reporting correct coordinates. Both
`MapCanvas` and `LocationPickerModal` use `style={{ position: 'absolute',
inset: 0 }}` for exactly this reason; the picker shipped without it once (TODO-10).

**Server state is TanStack Query.** Query keys and the mutations that invalidate
them live together in each feature's `queries.ts`, namespaced by module
(`'admin'`, `'auth'`, `'sales'`, `'technical'`) so invalidating a parent key
cascades. Screens supply only toasts.

**Task status is read-only in the web app.** Only a driver sets it, from mobile.
The badges and filters stay; the write controls were removed, and
`features/technical/__tests__/statusIsReadOnly.test.ts` fails if any file under
`src/features` outside a `queries.ts` calls a status-write hook. Do not
reintroduce one (TODO-08).

## Conventions

- **User-facing strings are Romanian** across all three projects, including
  backend exception messages (`"Ruta nu a fost găsită"`). Code, comments, and
  identifiers are English.
- `@/` aliases to `src/` in `web`, and to the project root in `mobile`.
- The Expo `slug` and `scheme` in `mobile/app.config.js` are still `"frontend"`.
  They are bound to the EAS project id and to installed apps' deep links —
  renaming them is a migration, not a cleanup.
- `TODO.md` items keep their id forever. Never delete or cross one out — mark it
  `[DONE]` and leave the text intact, and append new ideas with the next free id.
- **Anything found open goes into `TODO.md`, always — this is a standing rule.**
  A loose end noticed while doing something else (a gap, a stale comment, a
  cleanup deferred, a thing declined as out of scope, a follow-up handed over by
  another agent) gets its own item at the next free id, saying what was found,
  why it was not done, and what deciding it needs. Mentioning a finding in a
  reply does not record it — replies scroll away, `TODO.md` is the memory.

## Known gaps

Deliberate or unresolved; do not assume these are safe.

- **The mobile app cannot authenticate.** It still posts to the deleted
  `/api/auth/login` and has no enrollment screens (TODO-19). See "Auth" above.
- **No optimistic locking anywhere.** There is no `@Version` on any entity.
  Concurrent edits to the same task/route/order are silent last-write-wins, and
  because Spring Data `save()` issues a full-row UPDATE, the loser's other field
  changes are lost too.
- `spring.jpa.hibernate.ddl-auto=update` in base and prod — there is no
  migration tool. Local dev runs H2 while prod runs Postgres, so
  concurrency-sensitive bugs will not reproduce locally.
- **Two orphaned tables.** The Mistral-based intake feature was deleted
  (TODO-15) but `IntakeMessage` and `OrderDraft` were JPA entities, and
  `ddl-auto=update` never drops — their tables survive in H2 and in prod
  Postgres. Nothing in the code references them. Drop them by hand if the dead
  columns bother you. **Do not resurrect the feature:** AI work is postponed
  (TODO-17) and the only sanctioned future use is autofill.
- **`mobile/services/OrderLockService.ts` is a stub** that always reports a
  successful lock.
- `mobile/constants/ApiConfig.ts` reads `EXPO_PUBLIC_API_BASE_URL` and falls
  back to the old hardcoded `http://146.190.224.202:8080/api`. The fallback is
  load-bearing for installed builds; compose still publishes 8080 for them.
  New builds should set the env var to the HTTPS domain.
- `application-prod.properties` says its env vars are "provided by Render". They
  are not — `deploy.yml` SSHes into a VPS and passes them on the command line.
  The comment is stale.

## Security scanning

`.github/instructions/snyk_rules.instructions.md` applies repo-wide: run a Snyk
code scan on newly generated first-party code, fix what it reports using its
context, and rescan until clean.
