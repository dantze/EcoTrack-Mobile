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
three projects can share one repo.

## Commands

Always run these from the project subdirectory, not the repo root.

```bash
# backend
cd backend
./gradlew build                  # compile + run all tests
./gradlew test
./gradlew test --tests "*TokenServiceTest"                 # one class
./gradlew test --tests "*OrderServiceTest.createOrder_shouldThrowWhenClientNotFound"
./gradlew bootRun                # H2 file DB, enforcement ON by default (see below)
./gradlew bootRun --args='--spring.profiles.active=dev'    # same H2 DB, same enforcement
ECOTRACK_SECURITY_ENFORCE=false ./gradlew bootRun          # the way to turn it OFF now

# docker (full stack: backend + postgres + caddy with auto HTTPS)
docker compose up -d --build     # starts all 3 services in production mode
docker compose logs -f backend   # view backend logs
docker compose down              # stops all containers

# web
cd web
npm install
npm run dev        # http://localhost:5173, mock data by default
npm run typecheck
npm run build

# mobile
cd mobile
npm install
npm start
npm run android
npm run typecheck
```

`bootRun` auto-loads `backend/.env` via a custom task in `build.gradle`.
All three projects have tests: backend Gradle/JUnit (240), `web` Vitest
(326), `mobile` Vitest (83). Mobile's `vitest.config.ts` covers
`{utils,types,constants,services}`, and a services test must `vi.mock` every
native dependency with a factory or the real module loads and the suite dies.

## The security enforcement flag

`ecotrack.security.enforce` is the single most important thing to understand
before touching auth. It gates whether `/api/**` rejects unauthenticated
requests. It does **not** gate the auth machinery — enrollment/refresh/logout and
bearer-token validation always work, and `BearerTokenAuthenticationFilter`
always populates the SecurityContext for callers that do send a token.

| Where | Value | Why |
|---|---|---|
| `application.properties` (base, inherited by prod) | `${ECOTRACK_SECURITY_ENFORCE:true}` | **defaults to `true`** — overridable per environment |
| `application-dev.properties` | `true` | opt-in local enforcement |
| `application-test.properties` | `true` | `@SpringBootTest` exercises the real behaviour |

**Two stale claims to ignore, in the repo and in this file's own history.** The
base value was flipped to `true` in `bc47aec`, and the prose around it was not
updated: the comment in `application-prod.properties` still says production
"inherits the safe default of `false`" — it does not, it inherits `true`. This
table said the same thing until it was corrected. If something reads as
unenforced, check the `ECOTRACK_SECURITY_ENFORCE` env var actually set on the
box, not the comments.

Two companion knobs sit next to it, both **independent of `enforce`**:

- `ecotrack.security.reject-invalid-bearer` (default `true`) — a request whose
  Bearer token is unknown, expired or revoked gets a 401 even while `enforce` is
  `false`. Requests with **no** `Authorization` header are untouched, which is
  what keeps a token-less client working. Without it, a revoked token would keep
  working through the open gate and logout would be invisible to the client.
- The **role matrix** in `SecurityConfig`, written inside the `enforceSecurity`
  branch and therefore completely inert while `enforce=false`: `/api/admin/**`
  and employee writes need `ADMIN`; `PATCH /api/tasks/*/status` and
  `POST /api/tasks/*/photos` accept `DRIVER`/`SALES`/`TECH`/`ADMIN` (those two
  are the only writes the driver app makes — **a new mobile write needs a new
  row here**); other `/api/**` writes need `SALES`/`TECH`/`ADMIN`; `/api/**`
  reads need any authenticated employee; everything else is `denyAll()`.
  Authentication alone is not authorization: before this matrix existed, any
  valid token was effectively an admin token.

`AuthEnforcementOnTest`, `AuthEnforcementOffTest` and `AuthorizationMatrixTest`
cover both modes.

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

Note that `@WebMvcTest` slices are not profiled, so they see the base default
rather than the test profile's value. Both are `true` today, so the distinction
no longer changes behaviour — but it will again the moment the base default
moves, which is why it is still worth knowing.

### The client side of the contract

`mobile/` implements the token contract: `services/tokenStore.ts` holds the
pair, `services/http.ts` attaches `Authorization` and does a single-flight
refresh-and-retry on one 401, and `AuthService.logout()` revokes server-side.
Every EcoTrack call in `mobile/` goes through `apiFetch` — third-party calls
(Google Places in `LocationPicker`) deliberately do not, since that would leak
the bearer token to another host.

**`apiFetch(path, init, { anonymous: true })` is the exception that matters.**
`BearerTokenAuthenticationFilter` 401s any request carrying a token it cannot
validate, and it runs BEFORE authorization — so it fires on the `permitAll`
enrollment endpoints too. A device whose session was revoked still holds that
dead token, which would make the one screen that can recover the device the one
screen it cannot reach. All three enrollment calls are `anonymous`; a test
asserts it. **A new unauthenticated endpoint needs the same treatment.**

*Historical note:* this section used to explain what flipping `enforce` to
`true` was waiting on — every installed build having to send tokens first. That
rationale is spent (`/api/auth/login` is deleted, so older builds cannot
authenticate at all) and the base default is already `true`. See TODO-25.

### Enrollment is how anyone gets in — there is no login

Passwords and Google sign-in are gone; `POST /api/auth/login` no longer exists.
A device enrols and an admin approves it.

| Endpoint | Returns |
|---|---|
| `GET /api/enrollment/status` | `{awaitingBootstrap, setupCodeRequired}` |
| `POST /api/enrollment/request` | `{requestId, claimSecret, verificationCode, expiresAt, autoApproved}` · 403 bad setup code · 429 throttled |
| `POST /api/enrollment/claim` | 200 `LoginResponse` · **202 still pending** · 403 rejected · 410 expired/spent · 404 unknown |

The client shows `verificationCode` (six digits) and polls `claim` until it
stops returning 202. **`autoApproved` is how first-user-becomes-admin works** —
there is no separate bootstrap path, the first enrollee simply gets tokens on
its first poll. Requests live 10 minutes and, once approved, must be claimed
within 10 more (`ecotrack.enrollment.*`).

`AccessRequest` + `EnrollmentService` own this on the backend; the web entry
point is `EnrollmentPage`, the mobile one is `app/enrollment.tsx` plus
`services/EnrollmentService.ts`. The device id is client-minted and persisted —
it is a self-asserted label for revocation and polling, **not a credential**.

## Backend architecture

Standard controller → service → repository layering under
`com.example.damiProd`. The parts that need multiple files to understand:

**Domain inheritance.** `Order` and `Client` both use JPA
`InheritanceType.JOINED`. `Order` → `AmplasareOrder` / `RidicareOrder` /
`IgienizareOrder`, dispatched by Jackson `@JsonSubTypes` on an `orderType`
discriminator. `Client` → `Individual` / `Company`. Adding an order type means
touching the subclass, the `@JsonSubTypes` list, `web/src/features/sales/orderModel.ts`,
and `mobile/types/OrderTypes.ts` together.

**`Task` has three independent parents** — `route_id`, `order_id`, and
`recurring_plan_id`, each nullable and meaning something different. Tasks are
generated from orders and from `RecurringIgienizare` plans; `RecurringTaskScheduler`
tops up indefinite plans nightly at 02:00.

**Tokens are opaque, not JWTs.** `TokenService` mints 32 random bytes from
`SecureRandom` and persists only the SHA-256 hash in `Session`. 30-minute
access, **365-day** rotating refresh, revocable per device. TTLs are
`ecotrack.security.*`; the enrollment TTLs and throttle are a separate
`ecotrack.enrollment.*` group (`request-ttl-minutes`, `claim-ttl-minutes`,
`require-setup-code`, `max-requests-per-device-per-hour`).

**CORS lives in `SecurityConfig`, not `WebConfig`.** `WebConfig` is a
deliberately empty marker documenting why — Spring Security must own CORS once
it is on the classpath, and a second registration would double-add headers.

**Profiles.** Base and `dev` both use the H2 file DB at `backend/data/damiprod`;
`dev` sets `enforce=true`, which the base default now also does — the profile
is effectively redundant until the base changes. `prod` switches to Postgres, building its
JDBC URL from `DB_HOST`/`DB_PORT`/`DB_NAME` env vars. `test` = in-memory H2,
`create-drop`, `DataLoader` disabled.
`DataLoader` seeds roles, employees, and products only when those tables are empty.

## Web architecture

**The data layer has two interchangeable implementations behind one contract.**
`src/api/contract.ts` defines `EcoTrackApi`; both `src/api/live/` (real fetch)
and `src/mocks/` (seeded in-memory store) satisfy it exactly. `src/api/index.ts`
picks one from `VITE_DATA_MODE` at build time.

Feature code must import only `{ api } from '@/api'` — never from `@/api/live`
or `@/mocks` directly. That rule is the only thing keeping the two implementations
substitutable.

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

**`src/lib/orderLifecycle.ts` is the single definition of "is this order
finished?"** — used by the Comenzi archive split and by the map, and
**mirrored on the backend by `service/OrderFulfilmentPolicy.java`**, which gates
retiring a subscription that live orders still use. They are a deliberate pair:
change one and you must change the other, or the archive and the delete-guard
will disagree about the same order. The web mock imports the module directly
rather than reimplementing it, so live and mock cannot drift either. A test
asserts the two entry points (`deriveLifecycle` on a summarized status,
`deriveLifecycleFromTasks` on a task list) agree on every combination.

**`src/api/errors.ts` holds the errors the UI branches on**, as opposed to
merely displays. Both implementations throw them: `ApiError` and `MockApiError`
each pin a screen to one data mode, so anything a screen must *recognise* —
`SubscriptionInUseError` and its blocking-order list, for instance — has to live
here instead.

**`src/auth/tokenBridge.ts` is an acyclic seam,** not incidental indirection.
`http.ts` needs the current access token and a refresh-on-401 hook, but cannot
import `src/auth` because `AuthProvider` imports `@/api`. `AuthProvider`
registers its token and refresher into the bridge on mount. The access token is
held in memory only; only the refresh token survives a reload.

A 401 from anything other than `/auth/**` triggers exactly one silent
refresh-and-retry.

**Third-party map calls bypass `@/api` on purpose.** Map tiles come from
OpenFreeMap (`MAP_STYLE_URL` in `features/map/components/mapStyle.ts`) and
address search/reverse geocoding from Photon (`src/lib/geocoding.ts`); neither
is keyed, and neither goes through `http.ts`, because that would attach our
bearer token to someone else's host. Same rule and same reason as
`LocationPicker` in `mobile/`. MapLibre is ~250 kB gzipped, so everything that
imports it must stay behind a dynamic import — `/harta` via the route table,
the order location picker via `React.lazy` in `sales/components/fields.tsx`.

**A MapLibre container must be positioned with INLINE styles.** MapLibre stamps
`.maplibregl-map` onto the element it is given, and `maplibre-gl.css` sets
`position: relative` on that class — loaded after Tailwind's utilities, so it
beats `absolute inset-0`, the container collapses to height 0, and the map
renders a blank white box while still reporting correct coordinates. Both
`MapCanvas` and `LocationPickerModal` use `style={{ position: 'absolute',
inset: 0 }}` for exactly this reason; the picker shipped without it once (TODO-10).

**Server state is TanStack Query.** Query keys and the mutations that invalidate
them live together in each feature's `queries.ts`, namespaced by module
(`'technical'`, `'sales'`) so invalidating a parent key cascades. Screens supply
only toasts.

## Conventions

- **User-facing strings are Romanian** across all three projects, including
  backend exception messages (`"Ruta nu a fost găsită"`). Code, comments, and
  identifiers are English.
- `@/` aliases to `src/` in `web`, and to the project root in `mobile`.
- The Expo `slug` and `scheme` in `mobile/app.config.js` are still `"frontend"`.
  They are bound to the EAS project id and to installed apps' deep links —
  renaming them is a migration, not a cleanup.

## Known gaps

Deliberate or unresolved; do not assume these are safe.

- **No optimistic locking anywhere.** There is no `@Version` on any entity.
  Concurrent edits to the same task/route/order are silent last-write-wins, and
  because Spring Data `save()` issues a full-row UPDATE, the loser's other field
  changes are lost too.
- **`OrderService.createOrder` and `updateOrder` are now `@Transactional`**,
  protecting multi-step operations and inventory adjustments.
- **`mobile/services/OrderLockService.ts` is a stub** that always reports a
  successful lock.
- `spring.jpa.hibernate.ddl-auto=update` in base and prod — there is no
  migration tool. Local dev runs H2 while prod runs Postgres, so
  concurrency-sensitive bugs will not reproduce locally.
- `mobile/constants/ApiConfig.ts` reads `EXPO_PUBLIC_API_BASE_URL` and falls
  back to the old hardcoded `http://146.190.224.202:8080/api`. The fallback is
  load-bearing for installed builds; compose still publishes 8080 for them.
  New builds should set the env var to the HTTPS domain.
- `application-prod.properties` says its env vars are "provided by Render". They
  are not — `deploy.yml` SSHes into a VPS and passes them on the
  command line. The comment is stale.
- `SecurityConfig` and `application.properties` both say "See README.md" for the
  enforcement flag; the README has never contained that. This file is the
  reference instead.

## Security scanning

`.github/instructions/snyk_rules.instructions.md` applies repo-wide: run a Snyk
code scan on newly generated first-party code, fix what it reports using its
context, and rescan until clean.
