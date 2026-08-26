# Handoff — auth & security hardening

Status: **complete**, second pass. `cd backend && ./gradlew build` → BUILD SUCCESSFUL,
223 tests, 0 failures. `cd web && npm run typecheck && npm run test:run` → 216 tests, 0 failures.
`cd mobile && npm run typecheck` → clean.
Requires `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` — no JDK is on the default PATH.

`ecotrack.security.enforce` is still `false` in `application.properties` and
`application-prod.properties`. Nothing here flips it — see "Turning enforcement on".

## Done in the first pass

Role matrix in `SecurityConfig` (authentication was not authorization: any valid token was
effectively an admin token); H2 console disabled and denied in both modes; per-username login
throttle alongside the spoofable username+IP one; account-enumeration and timing oracle closed at
login; session cap, session-aware access-token expiry, nightly pruning, `revokeAllSessions`;
`reject-invalid-bearer` so a revoked token 401s even while the gate is open; security response
headers; CORS header allow-list; bcrypt 10 → 12; `GoogleAuthService.domainMatches` NPE;
`.gitignore` coverage for `backend/.env`.

## Done in this pass

**Seeded credentials were stored in plaintext.** `bootstrap/DataLoader.java` called `setPassword`
directly, so a freshly provisioned database held every staff password unhashed until each person
happened to log in and trip the legacy-plaintext migration. Now bcrypted at seed time. **The values
are unchanged** — they are still committed to this repo and therefore public; see "Needs YOU".
`BootstrapTests/DataLoaderTest` (new, 3) pins both the hashing and the values.

**An admin password change did not lock the old holder out.** `AdminService.updateEmployee` re-hashed
the password and stopped there, so every device that had ever logged in kept a refresh token good for
another 60 days — the exact opposite of what an admin does when an account is compromised or someone
leaves. Password *and* role changes now call `revokeAllSessions`. A role change counts because a
demotion that leaves the demoted session alive is not a demotion; an unchanged role list resent by
the web app does not count, or every profile edit would sign the employee out.
`ServiceTests/AdminServiceTest` (new, 5).

**`POST /api/employees` and `DELETE /api/employees/{id}` are gone.** Both bound the raw `Employee`
JPA entity from the request body: `roles` came from the caller (mint yourself an ADMIN) and
`password` was persisted exactly as sent, unencoded. Neither had a caller — web and mobile both write
through `/api/admin/employees`. `EmployeeService.saveEmployee`/`deleteEmployee` were removed with
them so nothing can re-wire the same hole; `EmployeeController` is read-only and says why.

**Refresh-token reuse detection covered only one rotation.** `Session.previousTokenHash` held a single
hash, so a token stolen and replayed three rotations later matched nothing and the theft passed
unnoticed. Replaced by `Session.retiredRefreshTokenHashes`, a bounded (10) chain in a
`session_retired_tokens` collection table, queried by `findActiveByRetiredRefreshTokenHash`.
Reuse still revokes only the session it belongs to, not the employee's others — a replay proves
*that family* leaked, and a client retrying a spent refresh would otherwise sign the whole crew out
of every device. `pruneStaleSessions` had to stop being a bulk JPQL `DELETE`, which would have
stranded the collection rows behind their foreign key; it selects and deletes entities now.
`TokenServiceTest` +5.

**Mobile now implements the token contract** — this was the blocker on enforcement.
- `mobile/services/tokenStore.ts` (new): the device's token pair, dependency-free so `http.ts` and
  `AuthService` don't have to import each other. Same role as `web/src/auth/tokenBridge.ts`.
- `mobile/services/http.ts` (new): `apiFetch(path, init)`, a drop-in for
  `` fetch(`${API_BASE_URL}…`) `` that returns the raw `Response`, attaches `Authorization`, and does
  a **single-flight** refresh-and-retry on one 401. Single-flight matters: parallel 401s each
  refreshing would rotate the token several times over and the losers would replay a spent one —
  which the backend now correctly reads as theft and revokes the session for.
- All 63 EcoTrack call sites across 11 files migrated. The Google Places lookups in
  `LocationPicker.tsx` deliberately stay on plain `fetch` — routing them through `apiFetch` would
  send our bearer token to Google.
- `AuthService.login` stores the pair; `AuthService.logout` now POSTs `/auth/logout` to revoke
  server-side before clearing (best-effort — a failed call must not trap someone signed in).
- The two "Deconectare" buttons (`RoleSelection`, `DriverRoutes`) only called `router.replace` and
  never `AuthService.logout`, so a phone handed on after logout kept a live 60-day token. Wired up.
- `app/_layout.tsx` registers a session-expired handler; a refresh the backend rejects is
  unrecoverable in-app, and without it the user sits on a screen where everything silently 401s.

Docs: `web/src/api/live/auth.ts` no longer quotes the removed
`"Utilizator inexistent"` / `"Parolă incorectă"` messages, and warns against branching on the
message at all. CLAUDE.md's enforcement section now covers `reject-invalid-bearer`, the role matrix,
and what flipping the flag actually depends on.

## Turning enforcement on

The code blocker is gone; what is left is a rollout question. **Every installed copy of the app has
to be a build that sends tokens.** Flipping `ecotrack.security.enforce=true` logs out every device
still running an older build, mid-route. Ship the mobile update, confirm rollout, then flip.

Worth staging in this order:
1. Ship mobile. Devices start sending tokens against a backend that is not enforcing — no visible change.
2. Watch for `REFRESH_TOKEN_REUSE_DETECTED` in the logs. That would mean the refresh path is racing
   somewhere the single-flight guard does not cover, and it must be quiet before step 3.
3. Flip `enforce=true`.

Note `reject-invalid-bearer=true` (already live) means a client with an expired or revoked token now
gets a 401 rather than being served anonymously. Both clients handle it with one silent refresh-and-retry.

## Needs YOU — not safe for an agent to do

1. **Rotate the leaked Google Maps API key.** `frontend/.env` committed
   `GOOGLE_MAPS_API_KEY=AIzaSyC93NYdvPrfesXhLM9cnVRM_1bNQUUQ1Z0` in `807aec2`, deleted in `13a7980`.
   It is still in git history and reachable from any clone. Rotate it in Google Cloud and add
   HTTP-referrer / app restrictions. History was not rewritten. **Unchanged from the last handoff.**
2. **Decide what to do about the seeded passwords.** They are bcrypted now, but the values
   (`admin`/`admin`, `tehnic1122`, `sofer23423`, …) are still in `DataLoader.java` in a repo anyone
   with a clone can read, and any environment seeded from it is running published credentials.
   Changing them in code only affects databases that have not been seeded yet — seeding runs once,
   against an empty employee table — and locks local dev out until the new values are known.
   Rotating the live ones is a `/api/admin/employees` job, which now revokes sessions as it goes.

## Known-and-left

- **No employee-facing password change/reset flow.** Staff cannot rotate their own password; only an
  admin can, through `/api/admin/employees`. This is the natural next piece and it is the reason
  item 2 above is awkward — there is nowhere for a user to change a published seed password
  themselves. `revokeAllSessions` / `revokeAllOtherSessions` are already in place for it.
- Token hash lookup uses a DB unique index rather than a constant-time compare. Not a practical
  timing oracle at this scale.
- `mobile/services/tokenStore.ts` uses AsyncStorage, which is app-private but not encrypted — a
  rooted device or an unencrypted backup exposes the refresh token. `expo-secure-store` is the
  upgrade and is not currently a dependency. The mitigations that do exist are server-side:
  rotation on every refresh with reuse detection, and the per-user session cap.
- `web/src/auth/**` and the token bridge still need no changes — single-flight refresh, in-memory
  access token and server-side logout revocation were already correct. The refresh token in
  `localStorage` stays the least-bad option until the backend has TLS.
- **Snyk CLI is still not installed on this machine**, so the scan CLAUDE.md asks for has not run on
  any of this. `npm i -g snyk && snyk auth && snyk code test` from each project directory.
