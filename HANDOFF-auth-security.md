# Handoff — auth & security hardening

Status: **complete**. `cd backend && ./gradlew build` → BUILD SUCCESSFUL, 212 tests, 0 failures.
Requires `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` — no JDK is on the default PATH.

All work is uncommitted in the working tree. Nothing here flips `ecotrack.security.enforce`;
it is still `false` in `application.properties` and `application-prod.properties`.

## Done

**Authorization existed nowhere.** The enforcement flag gates authentication only, so if it were
ever turned on, any valid token was effectively an admin token — including `POST /api/employees`,
which accepts an arbitrary role list (privilege escalation). `config/SecurityConfig.java` now
carries a role matrix, written inside the `enforceSecurity` branch so it is completely inert while
the flag is `false`:

| Route | Required |
|---|---|
| `/api/admin/**`, employee writes | `ADMIN` |
| `PATCH /api/tasks/*/status`, `POST /api/tasks/*/photos` | `DRIVER` / `SALES` / `TECH` / `ADMIN` |
| all other `/api/**` writes | `SALES` / `TECH` / `ADMIN` |
| `/api/**` reads | any authenticated employee |
| `/api/auth/**` | authenticated (drivers manage their own sessions) |
| anything else | `denyAll()` |

The driver row was derived by reading `mobile/app/Driver/*` — those two writes are the only ones
the driver app performs. If the mobile app gains a write, this matrix must gain a row.

**H2 console was enabled in production.** `spring.h2.console.enabled=true` sat in base and was
inherited by `prod`, which ships the H2 driver. With `enforce=false` that is an unauthenticated
arbitrary-JDBC-URL client on a bare public IP. Now `false`, plus deny matchers on `/h2-console/**`,
`/actuator/**`, `/env/**`, `/heapdump`, `/jolokia/**` in **both** modes. A dev who wants the console
back needs the property *and* a matcher change — deliberate.

**Login throttle was dodgeable.** `service/LoginRateLimiter.java` keyed on `username+IP`, and the IP
comes from caller-controlled `X-Forwarded-For` — rotating that header gave unlimited guesses. A
per-username counter (10 failures) now runs alongside the pair counter (5). Deliberately *not*
per-IP-only: prod sits behind one hop, so that would lock out the whole company. The map is bounded
(`max-tracked-keys`, prunes stale buckets) so invented usernames cannot exhaust the heap.

**Account enumeration + timing oracle at login.** `service/AuthService.java` returned distinct
messages for unknown-user vs wrong-password, and skipped bcrypt entirely on the unknown-user path.
Collapsed to one Romanian message (`"Nume de utilizator sau parolă incorectă"`), and the unknown-user
path now burns a real bcrypt verify against a startup-generated dummy hash.

**Session lifecycle** (`service/TokenService.java`, `repository/SessionRepository.java`): per-user
session cap (default 10, LRU revoked on login — a 60-day refresh token on a forgotten device was a
permanent live key); `validateAccessToken` now honours the session's own `expiresAt`, not just the
access-token window; nightly `pruneStaleSessions()`; new `revokeAllSessions(employeeId, reason)` for
password-reset / compromise flows (nothing calls it yet — see below).

**Revoked tokens kept working while the gate was open.** `config/BearerTokenAuthenticationFilter.java`
now 401s an unknown/expired/revoked Bearer token even with `enforce=false`
(`ecotrack.security.reject-invalid-bearer`, default true). Requests with **no** Authorization header
are untouched, so mobile is unaffected.

Also: security response headers in both modes (CSP `default-src 'none'`, `X-Frame-Options: DENY`,
nosniff, `Referrer-Policy: no-referrer`, HSTS for when TLS lands, no-store); CORS tightened to an
explicit header allow-list, and a wildcard origin is now dropped with an error log rather than
silently combined with credentials; bcrypt cost 10 → 12, configurable; `GoogleAuthService.domainMatches`
no longer NPEs on an unconfigured domain; `.gitignore` now covers `backend/.env` (it did not — only
`mobile/.env` and `web/.env` were ignored).

Tests: `SecurityTests/AuthorizationMatrixTest.java` (new, 10), `SecurityTests/LoginRateLimiterTest.java`
(new, 7, incl. the IP-rotation bypass), plus extensions to `AuthEnforcementOffTest` (+5),
`AuthServiceTest` (+5), `TokenServiceTest` (+4), `GoogleAuthServiceTest` (+3).

## Needs YOU — not safe for an agent to do

1. **Rotate the leaked Google Maps API key.** `frontend/.env` committed
   `GOOGLE_MAPS_API_KEY=AIzaSyC93NYdvPrfesXhLM9cnVRM_1bNQUUQ1Z0` in `807aec2`, deleted in `13a7980`.
   It is still in git history and reachable from any clone. Rotate it in Google Cloud and add
   HTTP-referrer / app restrictions. History was not rewritten.
2. **`bootstrap/DataLoader.java` seeds ~15 credentials in plaintext** (`admin`/`admin`,
   `tehnic1122`, `sofer23423`, …) — hardcoded in the repo *and* stored unhashed, because it calls
   `setPassword` directly instead of the encoder. They only self-heal on first login via the
   legacy-plaintext migration path. Hashing at seed time is a safe mechanical fix; **changing the
   password values is your call**, since it locks you out of local dev until you know the new ones.
   This file fell outside every agent's ownership, so it is untouched.

## Live prod behaviour changes (no config needed, but know about them)

- `reject-invalid-bearer=true` means a web client with an expired/revoked access token now gets 401
  instead of being served anonymously. The web app already handles this with one silent
  refresh-and-retry. Set the property to `false` to stage it.
- bcrypt 12 makes each login ~250ms.

## Known-and-left

- `POST /api/employees` binds the raw `Employee` entity; `AdminService.updateEmployee` changes
  passwords **without** revoking sessions — `revokeAllSessions` now exists for exactly this, but
  wiring it was outside ownership.
- No employee-facing password change/reset flow exists at all, only admin-side edit.
- Refresh-token reuse detection covers only the immediately-preceding token (`previousTokenHash`),
  not the full rotation chain, and revokes just that session rather than the user's others.
- Token hash lookup uses a DB unique index rather than a constant-time compare. Not a practical
  timing oracle at this scale.
- `web/src/auth/**` and the token bridge needed no changes — single-flight refresh, in-memory access
  token and server-side logout revocation are already correct. The refresh token in `localStorage`
  stays the least-bad option until the backend has TLS.
- **Snyk CLI is not installed on this machine**, so the scan CLAUDE.md asks for did not run.

## Doc drift worth fixing

- `web/src/api/live/auth.ts`'s header comment still quotes the old
  `"Utilizator inexistent"` / `"Parolă incorectă"` messages.
- CLAUDE.md's enforcement-flag section should mention `reject-invalid-bearer` and the role matrix.

## Enforcement is still blocked on mobile

`mobile/services/AuthService.ts` still discards `accessToken` / `refreshToken` and sends no
`Authorization` header. Until that changes, `enforce` cannot be turned on, and mobile traffic stays
both unauthenticated and unauthorized.
