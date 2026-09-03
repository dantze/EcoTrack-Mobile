# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

A monorepo with three independently deployed projects. There is no workspace
tool — each has its own dependencies and is built from its own directory.

| Dir | Stack | Deploy |
|---|---|---|
| `backend/` | Spring Boot 3.5, Java 21, Gradle, JPA | `deploy.yml` → SSH to a VPS, docker compose |
| `web/` | React 19, Vite 6, Tailwind 4, TanStack Query, React Router 7 | `deploy.yml` — same stack, same domain as the backend |
| `mobile/` | Expo ~54 / React Native 0.81, expo-router. **Drivers only** (TODO-33) | `deploy-mobile.yml` → EAS Update (OTA) / EAS Build |

**See `DEPLOYMENT.md`** for triggers, required secrets and the runbook. The
backend and web deploy together because Caddy serves both from one domain.

CI is split into `ci-backend.yml` / `ci-web.yml` / `ci-mobile.yml`, each filtered
on its own `paths:`. Keep that filtering when adding workflows — it is the reason
three projects can share one repo. `repo-hygiene.yml` has **no** `paths:` filter
on purpose and runs on every PR; it is the only check that covers files no
project workflow watches. `audit.yml` is scheduled, not a PR gate. See the
`verify` skill for which checks a given diff actually needs.

**`infra/` is a SECOND deploy target that has never been run.** Terraform for
GCP (Cloud Run + Cloud SQL + Artifact Registry + Secret Manager) and Vercel,
driven by `.github/workflows/deploy-cloud.yml`, with `ci-infra.yml` as its
path-filtered gate (`terraform fmt` + `validate`, no credentials needed). There
is no GCP project and no Vercel account yet, so none of it has been applied.
`deploy.yml` — VPS, docker compose, Caddy — is still the live deployment, and
the two are unrelated. The one difference that reaches application code: on the
VPS the SPA and the API share an origin, so CORS is inert; split across Cloud
Run and Vercel it is not, which is why `main.tf` sets
`ECOTRACK_CORS_ALLOWED_ORIGINS`. TODO-71 lists what must be decided first —
starting with the fact that Terraform state is local, so the workflow's `apply`
would fail on its second run.

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

`npm run dev` and `npm run build` in `web` run `scripts/fetch-ocr-assets.mjs`
first (as `predev`/`prebuild`). It copies the ID scanner's WASM engine out of
`node_modules` and, **once**, downloads a checksum-verified language model into
the gitignored `web/public/tesseract/`. So a clean checkout's first web build
needs network; every build after that finds the files and skips. `typecheck`,
`lint` and `test:run` do not need them.

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
`DELETE /sessions/{id}`, `DELETE /sessions`. All of them are **self-scoped** —
an admin cannot list or revoke someone else's sessions from anywhere (TODO-56).

**Losing every admin session is recoverable (TODO-30).** The last admin pressing
Deconectare used to be permanent: nobody could approve a request, and the
first-user-becomes-ADMIN path only reopens on an *empty employees table*, which
a logout does not produce. `EnrollmentService.isAdminLockedOut()` now detects
"zero usable ADMIN sessions" — measured on the **refresh** token, since an
expired access token is not a lockout — and logs a single-use recovery code, in
the same place and shape as the first-run code. Presenting it on
`/api/enrollment/request` mints a new ADMIN, which the device then claims
normally. The state is recomputed lazily on `GET /api/enrollment/status` and on
`/request`, because nothing else observes the transition: a logout is an
`/api/auth` call that knows nothing about enrollment.

Two rules hold it up. **The recovery code is required even when
`ecotrack.enrollment.require-setup-code=false`** — that flag exempts the
first-run land-grab, which needs an attacker to beat the owner to a brand-new
server, whereas a lockout is one button on one phone away. And **a request
carrying no code at all during a lockout stays an ordinary PENDING request**,
not a 403, so a driver who happens to ask in that window is not handed an error
they cannot act on. `ecotrack.enrollment.allow-admin-recovery=false` turns the
whole thing off. `SecurityTests/AdminLockoutRecoveryTest` covers it against the
real filter chain, reading the code out of the log — the only channel it has.

**Tokens are opaque, not JWTs.** `TokenService` mints 32 bytes from
`SecureRandom` and persists only the SHA-256 hash, in `Session`. 30-minute
access token, 365-day refresh token that **rotates on every use**, revocable per
device. Above `max-sessions-per-user` an employee's least-recently-used sessions
are revoked when a new one is issued, and unusable sessions are pruned nightly.
Every lifetime, the session cap and the enrollment rate limit are
`ecotrack.security.*` / `ecotrack.enrollment.*` properties in
`application.properties` — read them there rather than hardcoding a number.

**The phone is a driver device, not a second full app** (TODO-33). `mobile/`
has the driver experience and nothing else: my routes, my tasks, status
changes, photo upload. Sales and Technical were deleted from it — every
order-type change used to be written twice, and the web implementation is the
more complete of the two. Office staff use the responsive web app on the same
phone. An employee holding only SALES or TECH lands on `mobile/app/office.tsx`,
a signpost to the web app that **keeps the session**: `destinationForRoles`
reports `kind: 'office'` rather than `kind: 'none'`, because 'none' drops the
session and would loop a salesperson through an admin-approved enrollment on
every launch to be told the same thing.

**Both projects can get a session** (TODO-19). `web/` has
`features/auth/EnrollmentPage.tsx`; `mobile/` has `app/enrollment.tsx` plus
`services/EnrollmentService.ts`, and its password login is deleted. Token
plumbing is shared in spirit across both: `services/tokenStore.ts` holds the
pair and `services/http.ts` attaches `Authorization` and does a single-flight
refresh-and-retry on one 401.

**Mobile re-reads its own roles now** (TODO-35). `user.roles` is a cached copy in
device storage that decides which menus are drawn — it used to be written once,
at claim time, and never again, so an admin promoting or demoting someone left
the phone rendering buttons the backend would refuse.
`AuthService.syncCurrentUser()` re-reads the employee from `GET /api/auth/me` and
rewrites that copy; the boot gate (`app/index.tsx`) routes on the fresh answer,
and `setOnSessionRenewed` in `services/http.ts` runs it again after every silent
refresh, sending the device back through the gate only when the role SET actually
changed. A failed call keeps the cached copy: the refresh token is what proves
there is a session, and no-signal must not read as signed-out.

That is also why `apiFetch` no longer treats **all** of `/auth/**` as
non-retryable — only `/auth/refresh` and `/auth/logout`, which authenticate with
the refresh token. `GET /auth/me` is an ordinary bearer read, and at launch the
stored access token is nearly always past its 30-minute life, so the blanket rule
made the sync 401 and give up on every boot.

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
  makes — **a new mobile write needs a new row, above the catch-alls**. Since
  TODO-33 that is checked, not merely stated: mobile's ENTIRE API surface is
  declared in `.github/scripts/cross_project_invariants.py` and a new call
  fails repo-hygiene until it is added there); other
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
- `/api/tasks/employee/{id}` still exists for the office overview, and returns
  403 when a driver asks for an id that is not their own. Mobile still calls it
  from one place after TODO-33 — an ADMIN using `Driver/DriverSelection` to look
  at a chosen driver's day — which the policy allows because office staff are
  unrestricted.
- `GET /api/tasks/order/{id}/exists` is **office-only** (TODO-42). It summarises
  one order's task — id, route, schedule, status — and the order id is the only
  thing needed to aim at it, so an unguarded read let a driver walk the id space.
  It is `requireOfficeRole` rather than a row-scoped rule because no driver screen
  asks the question: every caller is an office screen in `web/src/features/sales`
  or `web/src/features/technical`. Mobile had callers too until TODO-33 deleted
  those sections, and now cannot reach it at all.
- `GET /api/tasks/order-status?ids=…` is the **batch** form of that read
  (TODO-43), and carries the **same** `requireOfficeRole` for the same reason
  (TODO-52) — unguarded it would be strictly worse, since one request would
  enumerate the order space rather than probe a single id. The id list is capped
  at 500 and refused with a 400 beyond it, never truncated: a short map reads as
  "these orders have no task", which is what decides Curente vs Arhivă. The web
  client chunks at 200.

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

**Retiring a subscription is serialised with a row lock.**
`SubscriptionRepository.findByIdForUpdate` is a `SELECT … FOR UPDATE` on the one
subscription row, and it is taken by `SubscriptionService.deactivate` *and* by
every path that attaches work to a plan — `OrderService.createOrder`/`updateOrder`
and `RecurringIgienizareService.create` (TODO-39). Retiring is a check-then-act
("nothing live points at this plan" → `isActive = false`) and order creation is
the write that invalidates it, while touching none of the same rows: with no
`@Version` there was nothing to conflict on. **The lock only decides who goes
second — each side must then re-read**: `deactivate` re-checks its blockers, and
the creating side re-checks `isActive` and refuses a retired plan with a 409.
Dropping either half reopens one of the two interleavings.

**CORS lives in `SecurityConfig`, not `WebConfig`.** `WebConfig` is a
deliberately empty marker documenting why — Spring Security must own CORS once
it is on the classpath, and a second registration would double-add headers.

**Profiles.** Base and `dev` both use the H2 file DB at `backend/data/damiprod`;
`dev` overrides nothing that matters any more. `prod` switches to Postgres,
building its JDBC URL from `DB_HOST`/`DB_PORT`/`DB_NAME` env vars. `test` =
in-memory H2, `create-drop`.
`DataLoader` seeds the role rows and the product catalogue, and only when those
tables are empty. It no longer seeds employees — the first enrolled device
becomes the first ADMIN instead.

**`DataLoader` runs under `test` too** — this file said it was disabled, and
that was wrong (TODO-31 verified it: 4 roles and 11 products in every
`@SpringBootTest` context). `spring.sql.init.mode=never` governs `schema.sql` /
`data.sql`, not a `CommandLineRunner`, and `SpringBootContextLoader` runs the
runners. Tests are written against the seeded catalogue, so it stays.

**Every `@SpringBootTest` gets its own database** (TODO-31). The suite used to
share one JVM-wide `jdbc:h2:mem:testdb`, and the classes that exercise the
first-user bootstrap cannot be `@Transactional` — they need committed state — so
each left an ADMIN behind for whoever ran next. `@AutoConfigureTestDatabase` on
every `@SpringBootTest` gives one uniquely-named database per Spring **context**;
contexts are still cached, so classes with matching configuration still share a
context, and now share only with each other. `SuiteTests/DatabaseIsolationTest.java`
carries the rule and fails if a new `@SpringBootTest` omits the annotation.

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

`countLiveByProductId` in the same repository is the third, and it is the same
`NOT EXISTS` for the same reason: **retiring a product is now a soft delete too**
(TODO-38), so a finished order keeps resolving its name and price through the
surviving row and no longer blocks. Produse and Abonamente are one rule now,
where they used to be two — the product delete was hard, which forced it to block
on *any* reference and meant a product sold once could never leave the catalogue.
`SubscriptionService.moveOrders` (TODO-37) is the fourth caller of the same
definition. All four move together.

`findLiveByProductId` is `countLiveByProductId` with the rows kept instead of
counted (TODO-57) — the count refuses the delete, the list is what
`GET /api/products/{id}/usage` names in the dialog explaining it. **One
predicate, written twice**, so a refusal that counted three orders cannot open a
dialog showing two; `FulfilmentRuleTest` runs both against every case in the
shared fixture. `GET /api/subscriptions/{id}/usage` is the same arrangement on
the subscription side.

Both are roll-ups over **all** of an order's tasks, because an order is not
limited to one: `TaskService.summariseOrderTasks` is what
`GET /api/tasks/order/{id}/exists` reports, and it answers COMPLETED whenever any
task is (TODO-34). **`shared/fulfilment-cases.json` is what holds the three sides
to the same answers** — the backend suite and the web suite both read that one
file, so a case added there fails whichever side does not follow it. Change the
rule by changing the fixture first.

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

**The UI runs two component libraries, on purpose.** shadcn/ui owns the chrome
(buttons, dialogs, menus, tables, tabs, command palette, toasts) and Mantine
owns the inputs and interaction logic shadcn does not do well (the date field,
combobox internals, charts, and `@mantine/hooks`). They read the SAME tokens, so
they look like one product. The split is decided, not negotiated per screen —
the `web-ui-shadcn` and `web-ui-mantine` skills carry the rules, and the
packaged upstream skills (`shadcn`, `mantine-combobox`, `mantine-form`,
`mantine-custom-components`) are installed under `.agents/skills`, symlinked
into `.claude/skills`.

Three layers, and feature code only ever sees the third:

| Path | What |
|---|---|
| `src/components/shadcn/*` | raw primitives, written by the CLI. Not edited by hand |
| `src/components/ui/*` | **the kit** — EcoTrack's own components, contract frozen in `types.ts` |
| `src/components/layout/*` | the Outlook shell: `AppShell`, `TopBar`, nav pane, `Workbench`, `CommandBar`, `ListDetail` |

**One token system, in `src/index.css`, and dark mode is real.** Every Tailwind
colour token is an indirection (`@theme inline`) onto a runtime CSS variable
that changes under `.dark`, so no component writes a `dark:` colour override.
`src/theme/ThemeProvider.tsx` owns light/dark/system and writes BOTH the `.dark`
class (Tailwind/shadcn) and `data-mantine-color-scheme` (Mantine); an inline
script in `index.html` stamps them before first paint. Mantine's stylesheets are
imported into `@layer mantine`, declared below Tailwind's layers — that is what
lets a utility class beat a Mantine style without `!important`.

**The screen shape is Outlook's**: a `CommandBar` ribbon over a list, and the
selected record in a `ListDetail` reading pane — resizable on `lg+`, a Sheet
below it. Clicking a row never costs the operator their place in the list.

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
bearer token to someone else's host. Mobile's Google Places call was the other
instance of the same rule and went with the Sales section (TODO-33) — the rule
outlives it, because the next third-party call will land here. MapLibre is
~250 kB gzipped, so
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

**Local state has three house rules, all from TODO-26.** They exist because the
same three mistakes were made on nearly every screen:

- **A highlighted index is clamped on READ**, never corrected in an effect — the
  list shrinks during render, and an effect fixes it one render too late, in
  which Enter commits nothing.
- **A dialog resets by not being mounted.** `Modal` renders `null` when closed,
  so a dialog with local state is a wrapper that returns `null` plus a body that
  only mounts while open — not a `useEffect` clearing fields on `open`.
- **A deep link is consumed by `useDeepLinkOnce` / `useDeepLinkFlagOnce`**
  (`lib/deepLink.ts`), not by a hand-rolled effect per screen. That hook is also
  where the one written argument for keeping such an effect lives.

**Task status is read-only in the web app.** Only a driver sets it, from mobile.
The badges and filters stay; the write controls were removed, and
`features/technical/__tests__/statusIsReadOnly.test.ts` fails if any file under
`src/features` outside a `queries.ts` calls a status-write hook. Do not
reintroduce one (TODO-08).

## Scanning an ID — and why no photo is stored

Creating a *persoană fizică* offers **Scanează buletinul**, which fills `nume
complet` and `CNP` from a photo of the card (TODO-13). Two rules govern it, and
both are load-bearing.

**1. It reads the MRZ, not the card.** The three 30-character OCR-B lines at the
bottom of any ICAO 9303 TD1 document. Romania puts the CNP in line 1's
optional-data field; the name is line 3. That choice is what makes a free
recogniser sufficient — **the MRZ verifies itself**, via four ICAO check digits,
the CNP's own control digit (weights `279146358279`, mod 11, 10→1), and the fact
that the CNP restates the birth date and sex that line 2 states separately.

So: **a read either passes every one of those checks or is refused.** A card
whose document number smudged is rejected even though nothing uses the document
number — a failed check digit means something was misread and the parser cannot
say what. Refusing costs two fields of typing; a false accept writes a wrong CNP
into a client record nobody re-reads. **Do not "improve" this by accepting
partial reads.**

The parser lives once, in `web/src/features/sales/idScan/mrz.ts`. It existed
twice — a byte-identical copy in mobile, pinned to it by
`shared/id-mrz-cases.json` because the two projects cannot import each other —
until TODO-33 deleted the mobile Sales section. The fixture stays and is still
where a case is added; it now has one reader rather than two.

**2. The image never leaves the device and is never stored** (TODO-14). Web runs
tesseract.js in the browser. Nothing about an identity document is uploaded, so
`PhotosController`, both `/{clientId}/idPhoto` routes and `GET /api/photos` are
gone, and `idPhotoUrl` is off the wire. The scanner was on-device on the phone
too, via ML Kit, and that dependency went with the screen.

Holding rule 2 requires one non-obvious thing: **tesseract.js defaults
`workerPath`, `corePath` and `langPath` to jsDelivr.** Unset, they would put a
third party in the request path of an ID scan. `web/scripts/fetch-ocr-assets.mjs`
puts the engine in `web/public/tesseract/` (copied from `node_modules`, plus a
checksum-verified language model) and `ocr.ts` points all three at our own
origin. `ocrIsLazy.test.ts` fails if any of them is dropped, if the file names
any `http` host, or if the ~6 MB engine stops being dynamically imported.

Same rule as the map, in the other direction: `src/lib/geocoding.ts` keeps our
bearer token off someone else's host; this keeps someone else's host out of our
scanner.

**That follow-up is closed** (TODO-45). `Individual.idPhotoUrl`,
`IndividualRepository` and the `/api/admin/id-photos` purge endpoint are
deleted: the owner confirmed no photos were ever uploaded, and no committed
database ever held a stored URL. **One thing was deliberately kept — the
prefix.** ID photos were written under **`persoane fizice/`**, with the space,
and `DEPLOYMENT.md` still carries it with a keys-only `aws s3 ls`. That is what
makes a stray object findable now that nothing in the database points at one; it
is the safety net that made deleting the column acceptable. The database COLUMN
still exists — `ddl-auto=update` never drops — and the manual DDL is in
`DEPLOYMENT.md` too.

**Task photos are private objects, served as presigned URLs** (TODO-46).
`PhotoService.uploadPhoto` writes `ObjectCannedACL.PRIVATE`, and
`GET /api/tasks/{id}/photos` signs a short-lived link per request rather than
returning the stored URL. Two consequences that are easy to get wrong:

- **The signature carries the access, so the guard on the endpoint is the whole
  authorisation.** `requireCanAccessTask` runs first; a signed URL needs no token,
  so anything that hands one out without an equivalent check grants access
  nothing downstream can withhold.
- **The URLs expire, so no client may persist one.** Web's `useTaskPhotos` sets
  no `staleTime` and mobile's `CloudPhotoViewer` holds them in component state —
  both correct today, and both load-bearing. The stored `task_photos.image_url`
  stays the canonical, unsigned identity of the object.

This was not a theoretical exposure: the object key is
`poze cabine/{taskId}_{clientName}/{n}`, so a public URL named a customer and its
last segment counted from 1 — one leaked link walked that client's other photos.
Objects uploaded before this change keep their old public ACL; `DEPLOYMENT.md`
has the one-time fix.

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

- **A phone's menus can lag a role change by up to one token refresh.**
  Narrowed, not closed, by TODO-35. `user.roles` is still a cached copy — what
  changed is that it is now re-read from `GET /api/auth/me` at every launch and
  after every silent refresh, instead of only at claim time. So the window is
  "until this device's next refresh or restart" (≤30 minutes of use) rather than
  "until it re-enrolls", and in practice a role change also revokes the
  employee's sessions (`AdminService.updateEmployee`), which forces the device
  through enrollment on its very next call. Nothing polls, so a phone sitting
  idle on a menu shows the old one until it is used. Never a privilege leak —
  authorization always reads the `Employee` the token points at, never the
  cached roles.
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
- **Installed phones need a REBUILD, not an OTA update, to pick up TODO-33.**
  It removed native modules (`react-native-maps`, ML Kit text recognition, the
  calendar and draggable-list packages) and the Google Maps key from
  `mobile/app.config.js`. `eas update` cannot ship a native change, so until
  `deploy-mobile.yml` runs `build-production`, installed builds keep the old
  binary — including its Sales and Technical screens, which still talk to a
  backend that will happily serve an office role.
- **The `individual.id_photo_url` COLUMN outlives the field that mapped it.**
  The Java side is gone (TODO-45) but `ddl-auto=update` never drops, so the
  column sits in H2 and in Postgres like the orphaned `intake_message` /
  `order_draft` tables above. Nothing reads or writes it. `DEPLOYMENT.md` has
  the `ALTER TABLE` and the bucket check to run first.
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
