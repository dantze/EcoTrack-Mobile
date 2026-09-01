---
name: auth-security
description: Use when touching authentication or authorization anywhere in this monorepo — the `ecotrack.security.*` / `ecotrack.enrollment.*` properties, `SecurityConfig`, `BearerTokenAuthenticationFilter`, `TokenService` / `Session`, the device-enrollment and admin-approval flow, roles, or the token plumbing in `web/src/auth` and `mobile/services`. Also use to debug "why is this 401 / 403", "it logs me out", "the device can't enroll", or to change a token lifetime or session limit. For adding one new `/api/**` route, use `api-endpoint` instead.
---

# Auth and security

Enforcement is **on** (`ecotrack.security.enforce` resolves to `true` in the
base properties, inherited by prod). Every mistake here is live, not latent.

## The five layers, in request order

1. **`config/BearerTokenAuthenticationFilter`** — reads
   `Authorization: Bearer <accessToken>`, validates it against a live,
   unexpired `Session`, and populates the SecurityContext with an
   `EmployeePrincipal` plus `ROLE_<name>` authorities. **No header → anonymous,
   never rejected here.** A header carrying an unknown, expired or revoked token
   → **401 in both enforcement modes** (`ecotrack.security.reject-invalid-bearer`,
   default `true`). That knob is what makes logout visible to the client.
2. **`ecotrack.security.enforce`** — whether an anonymous request may reach
   `/api/**` at all. Everything role-related in `SecurityConfig` lives inside
   the `enforceSecurity` branch and is **completely inert** when it is off.
3. **The role matrix** in `config/SecurityConfig` — which **VERBS** a role may
   use. First match wins. Full table in the `api-endpoint` skill.
4. **`service/TaskAccessPolicy`** — which **ROWS**. Consulted by
   `TaskController`, not by the filter chain. The matrix cannot answer this and
   never could.
5. **The clients** — `web/src/auth/` (`tokenBridge.ts`, `AuthProvider.tsx`,
   `storage.ts`) and `mobile/services/` (`tokenStore.ts`, `http.ts`).

## Diagnosing a 401 or 403

| Symptom | Where it comes from |
|---|---|
| 401, no `Authorization` header on the wire | the client never attached one: web `tokenBridge` not registered, or mobile has no stored pair |
| 401 with a token that "should" work | `reject-invalid-bearer`. The session is unknown, expired or revoked — access tokens last 30 minutes and the client is meant to refresh |
| logged out immediately / refresh loop | refresh tokens **rotate on every use**, so two parallel refreshes invalidate each other. Both clients single-flight the refresh for exactly this reason — keep it that way |
| 403 with a valid token | either the role matrix (wrong role for that verb) or `TaskAccessPolicy` (right role, wrong row). The policy's messages are Romanian |
| everything denied, reads included | the request fell through to `anyRequest().denyAll()` — the path is not under `/api/**`, or it hit the infra deny-list |
| works locally, 401 in prod | prod inherits `enforce=true` from the base properties; a local run with the property unset falls back to `SecurityConfig`'s `@Value` default of `false` |

## Enrollment is the only way in

There is no password and no Google sign-in — `/api/auth/login` and
`/api/auth/google` are gone, and `Employee` carries no credential.

1. `POST /api/enrollment/request` — full name + device id, answers a 6-digit
   code. Public by necessity, so it is rate-limited per device
   (`ecotrack.enrollment.max-requests-per-device-per-hour`).
2. An ADMIN approves or rejects under `/api/admin/enrollment/**`, choosing the
   role. Assignable roles are `EnrollmentService.ASSIGNABLE_ROLES`.
3. `POST /api/enrollment/claim` — issues the access/refresh pair.
4. **First run:** the first request against an empty database is auto-approved
   as ADMIN, gated by a one-time setup code logged at startup while
   `ecotrack.enrollment.require-setup-code=true`. Whoever opens a fresh server
   owns it permanently — there is no password path back in. Covered by
   `SecurityTests/EnrollmentBootstrapCodeTest`.

`web/` implements this in `features/auth/EnrollmentPage.tsx`.
**`mobile/` does not** — `services/AuthService.login` still posts to the deleted
`/api/auth/login`, so the mobile app cannot authenticate at all until TODO-19
ships. Its token plumbing is finished and correct; only the way in is missing.

## Changing a lifetime, a limit or a mode

Read the value from `backend/src/main/resources/application.properties`; never
hardcode one in a service or a client. The knobs, all documented in place:

`ecotrack.security.` — `enforce`, `reject-invalid-bearer`,
`access-token-ttl-minutes`, `refresh-token-ttl-days`, `max-sessions-per-user`,
`session-retention-days`, `session-prune-cron`.
`ecotrack.enrollment.` — `request-ttl-minutes`, `claim-ttl-minutes`,
`require-setup-code`, `max-requests-per-device-per-hour`.
Plus `ecotrack.cors.allowed-origins` — **CORS is owned by `SecurityConfig`, not
`WebConfig`**; adding a second registration double-adds headers.

Tokens themselves are opaque, not JWTs: `TokenService` mints 32 `SecureRandom`
bytes and persists only the SHA-256 hash in `Session`. Nothing about a token can
be read back out of it — a "decode the token" plan is a wrong turn.

## Adding or renaming a role

Role names are duplicated with no shared source of truth. All four move together:

- `bootstrap/DataLoader` — seeds the `EmployeeRole` rows on an empty database.
- `EnrollmentService.ASSIGNABLE_ROLES` — what an admin is allowed to grant.
- the constants at the top of `SecurityConfig` (`ADMIN`/`SALES`/`TECH`/`DRIVER`,
  `OFFICE`) plus every matrix row that names one.
- `ROLES` in `web/src/types/domain.ts`, which `hasRole` and `RequireAuth` gate on.

ADMIN is a superset by convention: it satisfies every business-write rule *and*
is the only role allowed near `/api/admin/**`.

## Tests

Under `backend/src/test/java/com/example/damiProd/SecurityTests/` — all
`@SpringBootTest` against the real filter chain, which is the only place
security assertions belong:

| Class | Covers |
|---|---|
| `AuthEnforcementOnTest` / `AuthEnforcementOffTest` | the shape of each mode |
| `AuthorizationMatrixTest` | a case per role per matcher |
| `TaskScopingTest` | `TaskAccessPolicy`, row-level |
| `EnrollmentFlowTest` | request → approve → claim |
| `EnrollmentBootstrapCodeTest` | first-user-becomes-admin and the setup code |

```bash
cd backend && ./gradlew test --tests "com.example.damiProd.SecurityTests.*"
cd backend && ./gradlew build     # once, before pushing
```

## Don't

- **Don't assert auth in a `@WebMvcTest`.** The slice does not pick up
  `SecurityConfig`, `ControllerTests/` disables filters with
  `@AutoConfigureMockMvc(addFilters = false)`, and `TaskAccessPolicy` is a
  `@MockitoBean` whose void guards no-op. Such a test passes whatever you do.
- **Don't commit `ECOTRACK_SECURITY_ENFORCE=false`** into a properties file,
  compose file or workflow. It is an environment-only escape hatch that opens
  `/api/**` to anonymous callers.
- **Don't take an employee id from the client** for "my own work". That is what
  let one driver read another's day. Use `/api/tasks/mine`, and
  `accessPolicy.callerId(principal)` server-side.
- **Don't let the refresh call recurse into the refresh-on-401 path.** Each
  client blocks that its own way and both are deliberate: `mobile/services/http.ts`
  calls `/auth/refresh` with a plain `fetch` instead of `apiFetch`, and
  `web/src/api/http.ts` skips the retry for every `/auth/**` path (a failed
  refresh is an expected outcome there, not a lapsed session). The refresh
  itself is single-flight on both sides — `AuthProvider.runRefresh` in web,
  `refreshInFlight` in mobile — because rotation makes parallel refreshes
  invalidate each other.
- **Don't send the bearer token to a third-party host.** Map tiles (OpenFreeMap),
  Photon geocoding in `web`, and the Google Places call in mobile's
  `app/Sales/OrderTypes/OrderComponents/LocationPicker.tsx`
  deliberately bypass the wrapper. Routing them through it leaks the token.
- **Don't rely on the last-admin lockout guard.** It exists only in
  `web/src/features/admin/EmployeesPage.tsx`. The backend has no equivalent
  check, so an API caller can demote the last ADMIN and lock everyone out of
  `/api/admin/**` permanently.
