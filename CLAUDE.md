# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

A monorepo with three independently deployed projects. There is no workspace
tool — each has its own dependencies and is built from its own directory.

| Dir | Stack | Deploy |
|---|---|---|
| `backend/` | Spring Boot 3.5, Java 21, Gradle, JPA | `.github/workflows/deploy-backend.yml` → SSH to a VPS |
| `web/` | React 19, Vite 6, Tailwind 4, TanStack Query, React Router 7 | not yet automated |
| `mobile/` | Expo ~54 / React Native 0.81, expo-router | EAS |

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
./gradlew bootRun                # H2 file DB, enforcement OFF (see below)
./gradlew bootRun --args='--spring.profiles.active=dev'    # same H2 DB, enforcement ON

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
Only the backend has tests; `web` and `mobile` have typecheck only.

## The security enforcement flag

`ecotrack.security.enforce` is the single most important thing to understand
before touching auth. It gates whether `/api/**` rejects unauthenticated
requests. It does **not** gate the auth machinery — login/refresh/logout and
bearer-token validation always work, and `BearerTokenAuthenticationFilter`
always populates the SecurityContext for callers that do send a token.

| Where | Value | Why |
|---|---|---|
| `application.properties` (base, inherited by prod) | `false` | **The deployed mobile app sends no tokens at all** and would break instantly |
| `application-dev.properties` | `true` | opt-in local enforcement |
| `application-test.properties` | `true` | `@SpringBootTest` exercises the real behaviour |

`mobile/services/AuthService.ts` stores only a user object in AsyncStorage —
there is no token storage and no `Authorization` header anywhere in `mobile/`.
Flipping this flag to `true` in production before the mobile app implements the
token contract will take the field crew offline. `AuthEnforcementOnTest` and
`AuthEnforcementOffTest` cover both modes.

Note that `@WebMvcTest` slices are not profiled, so they see the base default
(`false`) rather than the test profile's `true`.

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
access, 60-day rotating refresh, revocable per device. All TTLs and the login
throttle are `ecotrack.security.*` properties.

**CORS lives in `SecurityConfig`, not `WebConfig`.** `WebConfig` is a
deliberately empty marker documenting why — Spring Security must own CORS once
it is on the classpath, and a second registration would double-add headers.

**Profiles.** Base and `dev` both use the H2 file DB at `backend/data/damiprod`;
`dev` adds nothing but `enforce=true`. `prod` switches to Postgres, building its
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

Mock is the default deliberately: the production backend is plain HTTP on a bare
IP, which a browser refuses to call from an HTTPS origin. Live mode works from a
local dev server; a deployed live build needs TLS on the backend first.

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
held in memory only; only the refresh token survives a reload.

A 401 from anything other than `/auth/**` triggers exactly one silent
refresh-and-retry.

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
- **`OrderService.createOrder` is not `@Transactional`**, and its Ridicare
  availability check (two SUM queries, then a comparison, then a save) is a
  read-then-write race.
- **`mobile/services/OrderLockService.ts` is a stub** that always reports a
  successful lock.
- `spring.jpa.hibernate.ddl-auto=update` in base and prod — there is no
  migration tool. Local dev runs H2 while prod runs Postgres, so
  concurrency-sensitive bugs will not reproduce locally.
- `mobile/constants/ApiConfig.ts` hardcodes the production IP.
- `application-prod.properties` says its env vars are "provided by Render". They
  are not — `deploy-backend.yml` SSHes into a VPS and passes them on the
  command line. The comment is stale.
- `SecurityConfig` and `application.properties` both say "See README.md" for the
  enforcement flag; the README has never contained that. This file is the
  reference instead.

## Security scanning

`.github/instructions/snyk_rules.instructions.md` applies repo-wide: run a Snyk
code scan on newly generated first-party code, fix what it reports using its
context, and rescan until clean.
