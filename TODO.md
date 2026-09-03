# TODO — EcoTrack

Backlog of ideas, captured from conversation. **Nothing here is implemented yet**
unless its status says otherwise.

## How to use this file

- **Never delete or cross out an item.** Mark it `[DONE]` and leave the text intact.
- Items keep their ID forever, so they can be referenced in conversation
  ("do TODO-07").
- New ideas get appended with the next free ID.
- **Anything found open goes in here, always.** A loose end noticed while doing
  something else — a gap, a stale comment, a deferred cleanup, a thing declined
  as out of scope — gets an item at the next free ID rather than living in a
  chat reply that scrolls away. Write down what was found, why it was not done,
  and what deciding it needs. Reporting a finding is not recording it.
- **Where a new item goes:** at the END of the topical section it belongs to
  (A–J below), with the next free ID. IDs are a permanent NAME, not a position:
  they are therefore **not contiguous within a section**, and that is expected —
  TODO-27 sits between TODO-23 and TODO-28 under A because that is what it is
  about, not because of when it was written. Never renumber to tidy this up.
- **Adding an item or changing its status is two edits, not one:** the item
  itself, and its row in the *Index* below (plus the *Still open* list if the
  status crossed that line). The index is the only place that lists every item;
  a drifted index is worse than none.

**Status legend:** `[ ]` not started · `[~]` in progress · `[DONE]` done ·
`[POSTPONED]` deliberately deferred · `[?]` needs a decision first

**Next free ID: TODO-71.** (Highest used is TODO-70.)

---

## Still open — 24 of 70

The whole of what is left, in one place. Everything not listed here is `[DONE]`.

- **TODO-17** `[POSTPONED]` — All other AI ideas *(F)*
- **TODO-31** `[ ]` — The backend test suite shares one database across classes *(J)*
- **TODO-32** `[ ]` — Deploy fails at the SSH step — the VPS is unreachable *(G)*
- **TODO-33** `[ ]` — Make the web app responsive, and move Sales + Technical out of mobile *(H)*
- **TODO-45** `[ ]` — Drop `individual.id_photo_url` once every environment is drained *(E)*
- **TODO-48** `[ ]` — `bootNavigation.test.tsx` fails on Node 24 *(G)*
- **TODO-50** `[ ]` — Nothing checks that the index at the top of TODO.md is true *(G)*
- **TODO-51** `[ ]` — The web app throws away the server's Romanian refusal text *(J)*
- **TODO-53** `[ ]` — `CredentialRow.username` in the web mock is write-only *(A)*
- **TODO-54** `[ ]` — The live production build still ships the mock seed database *(G)*
- **TODO-55** `[ ]` — The bundle budget measures the mock build, not the deployed one *(G)*
- **TODO-56** `[ ]` — An admin cannot revoke another employee's session *(A)*
- **TODO-58** `[ ]` — The UI rebuild stopped short on four surfaces *(J)*
- **TODO-59** `[ ]` — The eager bundle grew from ~125 kB to ~260 kB gzip *(J)*
- **TODO-60** `[ ]` — Mantine's full stylesheet ships for four components *(J)*
- **TODO-61** `[ ]` — The legacy `brand-*` ramp has no dark values *(J)*
- **TODO-62** `[ ]` — `PageHeader` and `CommandBar` are two components for one job *(J)*
- **TODO-63** `[ ]` — The dispatch board is still drag-and-drop only *(J)*
- **TODO-64** `[ ]` — Two `/comenzi` tests time out under the full web suite *(J)*
- **TODO-65** `[ ]` — `web/`'s dependencies were declared but never installed *(J)*
- **TODO-66** `[ ]` — The map tiles stay light in dark mode *(J)*
- **TODO-67** `[ ]` — Confirm the map's cold-load fix against a live tile server *(J)*
- **TODO-68** `[ ]` — This machine cannot run the backend suite or the hygiene guards *(G)*
- **TODO-70** `[ ]` — Orders created before the numbering fix are still `#0` *(J)*

**Done, but flagged by whoever did it** — not open, but not finished-and-forgotten
either:

- **TODO-07** `[DONE — needs your eyes]` — BUG: drag-and-drop from "Neasignate" assigns on a nudge *(B)*
- **TODO-16** `[DONE — one judgement call, see below]` — Remove recommended additions to routes *(F)*

---

## Index

Every item, exactly once, in ID order. The section letter says where the item's
full text lives further down.

| ID | Status | Section | Title |
|---|---|---|---|
| TODO-01 | `[DONE]` | A | Admin section in the web sidebar |
| TODO-02 | `[DONE]` | A | Fold Șoferi into Angajați |
| TODO-03 | `[DONE]` | B | Routes are weekly, not dated |
| TODO-04 | `[DONE]` | B | Rework the Rute screen layout |
| TODO-05 | `[DONE]` | B | Change the driver on a route |
| TODO-06 | `[DONE]` | B | Remove the "Asignează" button on unassigned tasks |
| TODO-07 | `[DONE — needs your eyes]` | B | BUG: drag-and-drop from "Neasignate" assigns on a nudge |
| TODO-08 | `[DONE]` | C | Task status is driver-owned |
| TODO-09 | `[DONE]` | C | Better date filters on Sarcini |
| TODO-10 | `[DONE]` | D | Map picker when choosing a location on an order |
| TODO-11 | `[DONE]` | D | Remove Activ/Inactiv from Abonamente |
| TODO-12 | `[DONE]` | D | Calendar view next to Comenzi |
| TODO-13 | `[DONE]` | E | Scan an ID to autofill nume complet + CNP |
| TODO-14 | `[DONE]` | E | ID photos must not be readable by the developer |
| TODO-15 | `[DONE]` | F | Delete the Mistral-based AI work |
| TODO-16 | `[DONE — one judgement call, see below]` | F | Remove recommended additions to routes |
| TODO-17 | `[POSTPONED]` | F | All other AI ideas |
| TODO-18 | `[DONE]` | G | Fix the Dependabot config |
| TODO-19 | `[DONE]` | H | Mobile enrollment screens |
| TODO-20 | `[DONE]` | D | Block deleting a subscription that live orders still use |
| TODO-21 | `[DONE]` | D | Archive fulfilled orders out of Comenzi |
| TODO-22 | `[DONE]` | A | No backend guard against demoting the last admin |
| TODO-23 | `[DONE]` | A | Dead Google sign-in plumbing outside the backend |
| TODO-24 | `[DONE]` | G | Rotate the Google Maps key that is still in git history |
| TODO-25 | `[DONE]` | J | Backend logging: `System.out`/`System.err`, and a swallowed failure |
| TODO-26 | `[DONE]` | J | The web react-hooks lint backlog |
| TODO-27 | `[DONE]` | A | The 60-day refresh-token arithmetic no longer describes production |
| TODO-28 | `[DONE]` | A | Dead password-login plumbing in the web mock |
| TODO-29 | `[DONE]` | G | Nothing validates the docker-compose files |
| TODO-30 | `[DONE]` | A | There is no recovery path when the last admin loses their session |
| TODO-31 | **`[ ]`** | J | The backend test suite shares one database across classes |
| TODO-32 | **`[ ]`** | G | Deploy fails at the SSH step — the VPS is unreachable |
| TODO-33 | **`[ ]`** | H | Make the web app responsive, and move Sales + Technical out of mobile |
| TODO-34 | `[DONE]` | C | `/tasks/order/{id}/exists` returns one task, but the guard rolls up all of them |
| TODO-35 | `[DONE]` | H | Role changes on the web never reach the phone |
| TODO-36 | `[DONE]` | A | First-run setup code is only printed to the server log |
| TODO-37 | `[DONE]` | D | Bulk-move orders between subscriptions |
| TODO-38 | `[DONE]` | D | Produse deletion: hard delete, incomplete check, its own error format |
| TODO-39 | `[DONE]` | D | Check-then-act on subscription retirement is unserialized |
| TODO-40 | `[DONE]` | G | Three cross-cutting guard scripts |
| TODO-41 | `[DONE]` | G | Re-establish a golden-fixture guard for the fulfilment rule |
| TODO-42 | `[DONE]` | C | `/tasks/order/{id}/exists` is not row-scoped |
| TODO-43 | `[DONE]` | C | Comenzi asks for one order's task status per order |
| TODO-44 | `[DONE]` | G | `doc_claims.py` resolved paths with the OS separator |
| TODO-45 | **`[ ]`** | E | Drop `individual.id_photo_url` once every environment is drained |
| TODO-46 | `[DONE]` | E | Task photos are still uploaded with a public-read ACL |
| TODO-47 | `[DONE]` | G | `bundle_budget.py` counts lazy chunks named `index-*` as eager |
| TODO-48 | **`[ ]`** | G | `bootNavigation.test.tsx` fails on Node 24 |
| TODO-49 | `[DONE]` | G | CLAUDE.md's Known gaps still says mobile cannot authenticate |
| TODO-50 | **`[ ]`** | G | Nothing checks that the index at the top of TODO.md is true |
| TODO-51 | **`[ ]`** | J | The web app throws away the server's Romanian refusal text |
| TODO-52 | `[DONE]` | C | The batch order-status endpoint in TODO-43 needs TODO-42's guard |
| TODO-53 | **`[ ]`** | A | `CredentialRow.username` in the web mock is write-only |
| TODO-54 | **`[ ]`** | G | The live production build still ships the mock seed database |
| TODO-55 | **`[ ]`** | G | The bundle budget measures the mock build, not the deployed one |
| TODO-56 | **`[ ]`** | A | An admin cannot revoke another employee's session |
| TODO-57 | `[DONE]` | D | Produse has no "what is still using it" dialog |
| TODO-58 | **`[ ]`** | J | The UI rebuild stopped short on four surfaces |
| TODO-59 | **`[ ]`** | J | The eager bundle grew from ~125 kB to ~260 kB gzip |
| TODO-60 | **`[ ]`** | J | Mantine's full stylesheet ships for four components |
| TODO-61 | **`[ ]`** | J | The legacy `brand-*` ramp has no dark values |
| TODO-62 | **`[ ]`** | J | `PageHeader` and `CommandBar` are two components for one job |
| TODO-63 | **`[ ]`** | J | The dispatch board is still drag-and-drop only |
| TODO-64 | **`[ ]`** | J | Two `/comenzi` tests time out under the full web suite |
| TODO-65 | **`[ ]`** | J | `web/`'s dependencies were declared but never installed |
| TODO-66 | **`[ ]`** | J | The map tiles stay light in dark mode |
| TODO-67 | **`[ ]`** | J | Confirm the map's cold-load fix against a live tile server |
| TODO-68 | **`[ ]`** | G | This machine cannot run the backend suite or the hygiene guards |
| TODO-69 | `[DONE]` | J | Three bugs only a live backend could show |
| TODO-70 | **`[ ]`** | J | Orders created before the numbering fix are still `#0` |

---

## Sections

| | | |
|---|---|---|
| **A** Access & admin | **B** Rute | **C** Sarcini |
| **D** Comenzi | **E** ID scanning & photo privacy | **F** AI |
| **G** Repo & CI | **H** Mobile | **I** *(retired — see below)* |
| **J** Code health & platform | | |

---

## Open questions (answer before building the related items)

- **OQ-1 — What exactly is the difference between an Order (Comandă) and a
  Task (Sarcină)?** Related to TODO-12 and TODO-08. If this distinction is not
  obvious inside the app today, that is itself the bug, and it needs a
  conversation and probably a naming/UX fix before the calendar is built.
  *Current code:* an `Order` is what a client buys; `Task`s are generated from
  orders (and from recurring plans) and are what a driver executes on a route.
- **OQ-2 — Browser access.** Grant access to view the running web app (Chrome
  integration) so the drag-and-drop bug in TODO-07 can actually be seen rather
  than reasoned about blind.

---

## A. Access & admin (already designed, partly built)

*Enrollment, roles, admin screens and the auth plumbing around them.*

### TODO-01 `[DONE]` Admin section in the web sidebar
New `Admin` group in the left sidebar, visible to `ADMIN` only, containing:
- **Cereri de acces** — pending enrollment requests: full name, 6-digit
  verification code, device, countdown, role picker, approve / reject.
- **Angajați** — everyone using the app, their roles, promote/demote
  (including to admin), revoke a device/session.

Also replaces the old login screen with the enrollment flow (request button →
6-digit code → waiting → *"Sunteți înregistrat cu rol de <Rol>"*).

**Done (web + backend).** Backend: `AccessRequest`, `EnrollmentService`,
`/api/enrollment/**`, `/api/admin/enrollment/**`, first-user-becomes-admin,
setup code. Web: `EnrollmentPage` replaces the login screen (name → 6-digit
code → polling → *"Sunteți înregistrat cu rol de X"*), `Admin` sidebar section
gated on ADMIN, `Cereri de acces` with role picker + countdown, `Angajați` with
role changes and a **last-admin lockout guard**. `CreateEmployeeInput` lost its
`password` field; `AuthApi` lost `login`/`loginWithGoogle`; mock mode now boots
by driving the real request→claim path against an auto-approved dev device id.

**Still to do:** the MOBILE enrollment screens (see TODO-19).

### TODO-02 `[DONE]` Fold Șoferi into Angajați
`Șoferi` should not be its own sidebar entry under Tehnic. It becomes part of
the **Angajați** overview under Admin, visible to admins only.
**Done.** `/soferi` and `DriversPage.tsx` are gone; `Angajați` (`/angajati`,
ADMIN-only) replaces them. The command palette now points at `/angajati` and
`/cereri`. The old page's route-assignment/daily-workload view was NOT carried
over — it belongs on the Rute screen, and TODO-05 is where that lands.

### TODO-22 `[DONE]` No backend guard against demoting the last admin
The last-admin lockout guard exists **only in `web/src/features/admin/EmployeesPage.tsx`**.
`AdminService` has no equivalent check, so anything that is not that screen — a
direct API call, a future mobile admin view, a script — can demote or delete the
last `ADMIN` and permanently lock everyone out of `/api/admin/**`.

*Why it matters more than it looks:* with passwords gone there is no
break-glass path back in. The only recovery is the first-user-becomes-admin
bootstrap, which only fires when the employee table is empty — i.e. restoring
access would mean destroying data.

Needs deciding:
- Refuse the demote/delete with a 409 and a Romanian message (the shape TODO-20
  used for subscriptions), or refuse only the *last* one and let the UI explain?
- Does the same rule belong on session revocation — revoking the last admin's
  only device is the same lockout by another route.
- A `SecurityTests` case is the point of the change; the web guard stays as the
  friendly half.

**Done (backend only — the web guard is untouched and stays the friendly half).**
`AdminService` now refuses both routes with a **409** and a Romanian message:
`updateEmployee` when a `roleNames` payload would drop ADMIN from the last
admin, and `deleteEmployee` when the target is the last admin. Both throw
`IllegalStateException`, which `GlobalExceptionHandler` already maps to 409 —
the same shape TODO-20 used, and no new handler.

**The three questions, decided:**

**1. Refuse the operation, with 409 — not "refuse only the last one and let the
UI explain".** The refusal *is* only for the last one; what changed is that it
no longer depends on the UI. The message names the fix
(*"Promovează întâi pe altcineva"*) rather than only the problem.

**2. NO to session revocation — deliberately, and this is the half that stays
open.** It is a real lockout route: `claim` is single-use (`CLAIMED → EXPIRED`)
and `isAwaitingBootstrap()` is `employeeRepository.count() == 0`, so the last
admin logging out cannot get back in — nobody is left to approve a new device.
But refusing it is the wrong instrument: a sole admin who may never log out, and
who cannot revoke a stolen device, is a worse bug than the one being prevented.
The honest fix is a **recovery path**, not a refusal — see TODO-30.
`DELETE /api/auth/sessions` needs nothing either way: it is `revokeOtherSessions`
and always keeps the caller's own session.

**3. The count asks the database** (`EmployeeRepository.countByRoleName`,
`COUNT(DISTINCT e)` because `roles` is a ManyToMany and a plain count over the
join would see one admin as two). Not airtight — there is no `@Version` anywhere
in this app, so two admins demoting each other concurrently can still both read
"2" — but the window is the transaction rather than the request.

**Verified: `./gradlew build` on JDK 21 — BUILD SUCCESSFUL, 241 tests, 0
failures**, and the suite was then run three times over to be sure (see TODO-31:
it was NOT reliably green before this change, for unrelated reasons).

New `SecurityTests/LastAdminGuardTest` (9 tests) runs the real filter chain: the
two refusals, that a refused demotion writes nothing, that the message is
Romanian, and — the half that matters as much — four allowances, so the guard
cannot quietly become "admins may not be edited": demoting/deleting one of two
admins, deleting a non-admin, editing the last admin's NAME, and widening their
roles while keeping ADMIN.

### TODO-23 `[DONE]` Dead Google sign-in plumbing outside the backend
Google sign-in and password login are gone from the backend, and the orphaned
`ecotrack.google.*` properties went with the refactor. The **deployment and
build plumbing still passes the values**: `GOOGLE_CLIENT_ID` and
`GOOGLE_ALLOWED_DOMAIN` in `.github/workflows/deploy.yml` and
`docker-compose.yml`, `VITE_GOOGLE_CLIENT_ID` in `docker-compose.yml` and
`web/Dockerfile`, and on the web side `GOOGLE_CLIENT_ID` in `src/lib/config.ts`,
`VITE_GOOGLE_CLIENT_ID` in `src/vite-env.d.ts` and `MOCK_GOOGLE_DEMO_USERNAME`
in `src/mocks/seed.ts`. Stale `/auth/google` comments sit on the `email` field
in `types/domain.ts` and `mocks/store.ts`.

Harmless but misleading — it reads as if the app still supports Google auth.
**Do it as one sweep across all three layers**: deleting only the `web/src/`
half leaves build args feeding a variable nobody reads, which is worse than
either end alone. Confirm no deployment secret is still expected before removing
the workflow entries.

**Done as one sweep, all three layers.**

- **Deploy/build:** `GOOGLE_CLIENT_ID` / `GOOGLE_ALLOWED_DOMAIN` gone from
  `deploy.yml` (both the `env:` block and the `envs:` passlist),
  `docker-compose.yml`, `docker-compose.dev-hosted.yml` and `.env.example`;
  `VITE_GOOGLE_CLIENT_ID` gone from `web/Dockerfile` (ARG **and** ENV),
  `docker-compose.yml`, `.env.example` and `web/.env.example`.
- **Web:** `GOOGLE_CLIENT_ID` deleted from `src/lib/config.ts`,
  `VITE_GOOGLE_CLIENT_ID` from `src/vite-env.d.ts`, `MOCK_GOOGLE_DEMO_USERNAME`
  from `src/mocks/seed.ts` — all three had **no consumer left anywhere in
  `src/`**, so nothing changed behaviour.
- **Comments:** the stale `/auth/google` lines on `email` in `types/domain.ts`
  and on `CredentialRow` in `mocks/store.ts` now say what the field actually is
  (an optional contact detail nothing authenticates with).

**The precondition checked before touching the workflow:** `grep -rn "google"
backend/src/main/resources/` returns **nothing** — no `ecotrack.google.*`
property survives, so those env vars were reaching a Spring container that
ignored them. No deployment secret is still expected. The GitHub secrets
themselves (`GOOGLE_CLIENT_ID`, `GOOGLE_ALLOWED_DOMAIN`) are now unreferenced
and can be deleted in **Settings → Secrets** — that is a click in the GitHub UI,
not a repo change, so it is left to you.

**Deliberately NOT touched:** the backend comments in `AuthController`,
`AuthService`, `SecurityConfig`, `Employee` and `EnrollmentFlowTest` that
mention Google. They are accurate — they document that the endpoint was removed,
and `EnrollmentFlowTest.loginEndpointsAreGone` actively asserts `POST
/api/auth/google` no longer answers. That test is the regression guard for this
whole item. Also untouched: `google.com/maps` deep links in
`mobile/app/Driver/TaskDetails.tsx` and `sales/OrderDetailDrawer.tsx`, and the
Google Places key in mobile — those are Maps, not sign-in.

**Verified (web + hygiene; backend and mobile untouched so their CI does not
run):** 372 tests green in 26 files, typecheck clean, lint 0 errors / 105
warnings (unchanged — that is the TODO-26 backlog), build clean, bundle
**139.4 kB / 160 kB** (down from 139.7). Hygiene green after TODO-29.

### TODO-27 `[DONE]` The 60-day refresh-token arithmetic no longer describes production
`ecotrack.security.refresh-token-ttl-days=365`, but `TokenService`'s javadoc and
its worked example still reason in terms of the 60-day code default
(`@Value(":60")`). Neither is strictly wrong — the comments document the
fallback — but the arithmetic ("a session that refreshes every 30 minutes for
its 60-day life") describes a configuration production does not run.

Decide which number is intended, then make the property, the fallback and the
prose agree. A 365-day refresh token is a year-long credential on a lost device;
if that is deliberate it deserves a sentence saying so next to the session cap
and the nightly prune.

**Decided: 365 is the intended number, and everything now says so.** The reason
is that removing password login removed the cheap way back in — a driver whose
refresh token dies mid-shift cannot sign in again, they file an enrolment request
and wait for an admin. A year means that only happens to a device genuinely idle
for a year. Changed: `TokenService`'s `@Value` fallback `:60` → `:365`, so an
absent property can no longer give a lifetime the properties file does not state;
the `MAX_RETIRED_TOKEN_HASHES` worked example (~2900 rotations → ~17,500) and the
`enforceSessionCap` javadoc; `Session.retiredRefreshTokenHashes` and the
`expires_at` comment, which now names the property instead of restating a number
that can drift; `TokenServiceTest`, `AdminServiceTest`; and the two mobile
`Menu.tsx` logout comments plus `AuthService.logout`.

**The sentence TODO-27 asked for is in `application.properties`, and it states
the cost rather than only the benefit:** a lost phone holds a working credential
for up to a year, expiry is not what bounds that, and the things that do are the
session cap, the nightly prune (which only removes what is already unusable), and
a role change or employee deletion — each named there.

**Found while writing it, and NOT true as first drafted:** the obvious mitigation
— an admin revoking one employee's stolen device — does not exist.
`DELETE /api/auth/sessions/{id}` is self-only (`AuthController` passes
`principal.getEmployee().getId()`), and `/api/admin/**` has no session route at
all. Recorded as **TODO-56**; the comment now says what is actually there.

**Also fixed in passing:** `AdminServiceTest`'s class javadoc still framed itself
around "an admin changing a password", which has not existed since password login
was removed. Its tests are about role changes, and it now says so.

### TODO-28 `[DONE]` Dead password-login plumbing in the web mock
Found while doing TODO-23, and left alone because it is the **password** half,
not the Google half — a different question with a different answer.

`MOCK_CREDENTIALS_HINT` ("Exposed so the login screen can tell a demo user what
to type") and `MOCK_AUTO_LOGIN` are both defined in `web/src/mocks/seed.ts` and
re-exported twice — from `src/mocks/index.ts` and again from `src/api/index.ts`
— and **neither has a single consumer in `src/`**, tests included. There is no
login screen any more: mock mode boots by driving the real request→claim
enrollment path against `DEV_DEVICE_ID` (TODO-01), which is the export beside
them that *is* used.

Behind them sits the bigger question: `CredentialRow` still carries a
`password`, and `MOCK_PASSWORD = 'demo'` is stamped onto all ~8 seeded
employees, for a system that has no password anywhere.

Needs deciding: delete the two dead exports only, or drop `password` from
`CredentialRow` entirely and keep the row for `email`? The second is the honest
one but touches `toAuthUser`, `currentEmployee`, `issueSession` and
`findApprovableEmployee` in `mocks/index.ts`, so it wants its own reading rather
than being smuggled into a comment sweep.

**Resolved — the second, honest option.** `password` is gone from
`CredentialRow` entirely and the row survives for `email`, which is the one
field on it that anything actually reads. Deleted: `MOCK_PASSWORD` and the two
dead exports `MOCK_CREDENTIALS_HINT` / `MOCK_AUTO_LOGIN` in
`web/src/mocks/seed.ts`, their re-export from `src/mocks/index.ts`, and their
re-export from `src/api/index.ts` (whose doc comment still promised them to a
`LoginPage` that has not existed for several items — it now documents
`DEV_DEVICE_ID`, the one export beside them that is used). The `password: ''`
that `employees.create` stamped on every new row went with them.

`toAuthUser`, `currentEmployee`, `issueSession` and `findApprovableEmployee`
needed no change after all: all four pass a `CredentialRow` around but only
`toAuthUser` dereferences it, and only for `credential.email`. The mock's boot
path is untouched — `enrollment.request` → `claim` against `DEV_DEVICE_ID` still
short-circuits to an approved ADMIN ticket, and `auth/__tests__/mockAutoLogin.test.tsx`
passes.

Nothing crossed the contract: none of the deleted symbols was ever on
`EcoTrackApi`, so `src/api/live/` had no counterpart to keep in step and mock and
live stay substitutable.

### TODO-30 `[DONE]` There is no recovery path when the last admin loses their session
Split out of TODO-22, which fixed the *demote/delete* route and deliberately did
not touch this one.

The last admin can still lock everyone out permanently by ordinary means:
`POST /api/auth/logout`, or `DELETE /api/auth/sessions/{id}` on their own only
device. Nothing about that is exotic — it is what "log out" does. It is
unrecoverable because two things line up: `EnrollmentService.claim` is
single-use (`CLAIMED → EXPIRED`, so the device cannot re-claim its old approval)
and `isAwaitingBootstrap()` is `employeeRepository.count() == 0`, so the
first-user-becomes-ADMIN path only reopens on an **empty employee table**. The
only recovery is destroying all employee data.

TODO-22 decided NOT to fix this by refusing the operation: an admin who may
never log out, and who cannot revoke a device they just had stolen, is worse
than the lockout. So the fix has to be a way back IN. Options, none chosen:

- **Re-announce the setup code** when the admin count drops to zero — reuses the
  bootstrap machinery already in `EnrollmentService`
  (`announceSetupCodeIfUnclaimed`), but it currently keys on an empty table, and
  "zero admins" is a different and much more reachable condition.
- **Let a previously-approved device re-enroll without approval**, keyed on its
  device id. Weakens the single-use property that exists to stop a leaked claim
  secret minting a second session.
- **An out-of-band break-glass code** in config, which is a password by another
  name and would undo part of why credentials were removed.

Needs deciding before building. Whichever is picked, it wants a `SecurityTests`
case in the shape of `LastAdminGuardTest`.

**Decided: option 1, re-announce a code — but keyed on SESSIONS, not on the
admin count.** The owner's call was that logging out should be an ordinary thing
to do, with a new session made afterwards; that only works if there is a way to
make one.

"Zero ADMIN employees" turned out to be the wrong trigger even though the item
listed it: `AdminService`'s last-admin guard already makes it near-unreachable,
and it was never the failure anyway. The lockout is an admin who **exists** and
cannot sign in. So `EnrollmentService.isAdminLockedOut()` asks
`SessionRepository.countUsableSessionsForRole("ADMIN", now) == 0`, measured on
the **refresh** token — a 30-minute access token expiring is not a lockout, its
owner refreshes — and excluding the empty-table case, which is first run and
already handled.

Option 2 (let an approved device re-enrol on its device id) was rejected for the
reason the item gives: it weakens the single-use claim secret. Option 3 is a
password by another name.

**How it behaves:**

- Entering the state logs a single-use recovery code, same shape and same place
  as the first-run code. Reading it needs server access — which is the whole
  security argument, since someone with it could edit the database anyway.
- Presenting it on `/api/enrollment/request` mints a **new** ADMIN employee; the
  device then claims it normally. New rather than a session grafted onto the old
  employee: the name on the form is not proof of identity, so picking an existing
  employee would be inventing an authorisation decision from a string. The stale
  admin keeps their row and their zero sessions, and can be tidied up in Angajați.
- Recomputed lazily on `GET /api/enrollment/status` and on `/request`. Nothing
  else observes the transition — a logout is an `/api/auth` call that knows
  nothing about enrollment, and an admin whose refresh token simply expires makes
  no request at all. `refreshRecoveryCode()` is idempotent, so polling the status
  endpoint cannot flood the log; it logs on the transition only.
- **The code is required even when `require-setup-code=false`.** That flag
  exempts the first-run land-grab, which needs an attacker to beat the owner to a
  brand-new server. A lockout is one button on one phone away, so it never gets
  the exemption. `ecotrack.enrollment.allow-admin-recovery=false` disables the
  mechanism entirely and restores the old permanent lockout.
- **No code at all during a lockout files an ordinary PENDING request, not a
  403.** A driver who happens to ask in that window knows nothing about any of
  this and must not be handed an error they cannot act on; their request simply
  waits, exactly as before. A code presented when *neither* state is open IS a
  403, because filing it silently would leave the sender waiting on a decision
  they think they already made.

**A bug the tests caught, in the first version of this:** `refreshRecoveryCode()`
was called only in the non-bootstrap branch of `request()`, so a code minted for
one lockout stayed live across the next one — silently accepted, never
re-announced, leaving the operator with no code in the log and an old one still
working. It is now called unconditionally at the top of `request()`, which is
what actually expires a code when its lockout ends.

`SecurityTests/AdminLockoutRecoveryTest` covers all nine paths against the real
filter chain, including that a live DRIVER session does not hide the lockout.
**It scrapes the code out of the log on purpose** — that is the code's only
delivery channel, and a test that reached into the service for it would be
testing something production does not have.

Clients: `GET /api/enrollment/status` gained `adminLockout`, wired through
`web/src/api/contract.ts` + `live/enrollment.ts` + the mock, and
`mobile/services/EnrollmentService.ts` (absent key reads as `false`, so an older
backend renders the pre-existing form). Both screens render the one existing code
field with different Romanian wording — *Cod de recuperare* vs *Cod de
configurare* — because the person reading it is looking in a different place.

**Not done here, and split out as TODO-56:** the owner also wanted the admin
panel to show a signed-out user's session. An admin cannot see or revoke another
employee's sessions at all today, which is a bigger gap than this item.

### TODO-36 `[DONE]` First-run setup code is only printed to the server log
Whoever performs the very first enrolment needs SSH access to read the setup
code out of the backend log (`ecotrack.enrollment.require-setup-code=true`).
Workable for the current operator, but the app cannot be bootstrapped by a
non-technical user, and this will be forgotten by the time it matters.

*Found while building TODO-19.*

**Fixed both halves: a code that can be chosen up front, and a runbook.**

`ecotrack.enrollment.setup-code` (env `ECOTRACK_SETUP_CODE`, blank by default)
lets whoever deploys pick the first-run code instead of reading a generated one
out of the log. Set it and no SSH is needed at all; leave it blank and nothing
changes. Threaded through `docker-compose.yml`, `docker-compose.dev-hosted.yml`,
`deploy.yml` (both the `env:` block and the `envs:` allowlist — missing either
silently drops it) and `.env.example`.

**A configured code is NOT logged.** The operator already has it, and printing a
chosen secret would copy it into every log aggregator for nothing. The generated
one is still printed, because the log is its only delivery channel.

**Under 12 characters it is IGNORED, with an error, and a generated one is used
instead.** `/api/enrollment/request` is public and its rate limit is keyed on a
client-supplied device id, so a guessable first-run code hands the instance to
whoever guesses it — permanently, since there is no password path back in.
Failing this way costs one SSH session; obeying it costs the system.
`ShortConfiguredSetupCodeTest` pins the refusal, `ConfiguredSetupCodeTest` the
accepted path, its case-insensitivity, and that it goes inert once an employee
exists.

**It is deliberately not accepted for TODO-30's lockout recovery.** A code that
sits in config and always mints an ADMIN is the "out-of-band break-glass code"
TODO-30 rejected as a password by another name. Recovery codes are always
generated and always read from the log.

**A bug found while writing the tests, in TODO-30's code:** between the bootstrap
request and the claim that follows it, an ADMIN employee exists with no session —
so `isAdminLockedOut()` reported a lockout and a normal first run announced a
LOCKOUT banner seconds after starting. It now also asks whether an APPROVED,
unexpired ADMIN grant is outstanding
(`countByStatusAndAssignedRoleNameAndExpiresAtAfter`): nobody-can-get-in is not
the same as somebody-is-halfway-in.

**The "will be forgotten" half is DEPLOYMENT.md**, which now has a *First
enrolment* section (both routes, with the `openssl rand` line and the
`docker compose logs | grep` recipe) and a *Recovering when no admin can sign in*
section for TODO-30. That is where someone will look at 2am, not this file.

### TODO-56 `[ ]` An admin cannot revoke another employee's session
Found while doing TODO-27, writing the sentence that item asked for about what
bounds a year-long refresh token. The obvious answer — "an admin revokes the lost
device" — is not implemented, so the draft comment claimed a capability the code
does not have.

`DELETE /api/auth/sessions/{id}` and `DELETE /api/auth/sessions` both scope to
the caller: `AuthController` passes `principal.getEmployee().getId()` into
`AuthService`, so an admin can only ever revoke their own devices. `GET
/api/auth/sessions` is the same. `/api/admin/**` has no session route at all.

So when a driver's phone is lost, an admin's only levers are blunt:
- change that employee's roles, because `AdminService.updateEmployee` revokes
  every session on a role change — a side effect, not an intent, and it changes
  what they are allowed to do;
- delete the employee;
- wait out `ecotrack.security.refresh-token-ttl-days`, which is **365**.

`TokenService.revokeAllSessions(employeeId, reason)` already exists and is what a
fix would call. The shape is roughly `GET /api/admin/employees/{id}/sessions` and
`DELETE /api/admin/employees/{id}/sessions[/{sessionId}]`, ADMIN-only, plus a
matcher row above the `/api/admin/**` catch-all and an `AuthorizationMatrixTest`
case. The one real design question is whether an admin should see another
employee's device labels and IPs at all, or only be able to revoke blind.

Overlaps **TODO-30** (recovery when the last admin loses their session) and the
session list the owner asked for there — build them together, since both want an
admin-facing view of somebody else's sessions.

### TODO-53 `[ ]` `CredentialRow.username` in the web mock is write-only
Found while doing TODO-28. With `password` gone, the row carries `employeeId`,
`username` and `email` — and `username` is written in three places
(`seed.ts`'s `createSeedDb`, `employees.create`, and `employees.update`, which
keeps it in sync when an employee is renamed) while **nothing anywhere reads
it**. Every lookup goes through `employeeId`; `toAuthUser` takes the username
off the `Employee`, not off the credential row.

Left alone deliberately: TODO-28 scoped the row down to "keep it for `email`"
and stopping at `password` kept that change reviewable. It is the same shape of
dead plumbing, one field smaller, and deleting it also removes the `if
(credential && input.username)` line from `employees.update`.

Needs deciding: drop `username` and let the row be `{ employeeId, email }` — at
which point "CredentialRow" is a misnomer for what is really an employee-email
side table and probably wants renaming — or keep it as a debugging affordance.

---

## B. Rute (routes)

*The dispatch board and everything about assigning work to a route.*

### TODO-03 `[DONE]` Routes are weekly, not dated
A route belongs to a **day of the week**, not a calendar date. Drop the date
entirely. Changing a route changes it for every week from then on — routes are
not edited in advance for a specific date.

**Done, all three projects.** Backend: `Route.date` column removed, constructor
now takes `dayOfWeek`, `CreateRouteRequest.date` gone, and
`GET /routes/employee/{id}/date/{date}` became
`GET /routes/employee/{id}/day/{dayOfWeek}`. Web: `Route.date` and
`CreateRouteInput.date` removed, `listForEmployeeOnDate` → `listForEmployeeOnDay`,
mock seed names routes after their weekday, `MapRouteLine.date` → `dayOfWeek`,
and `grouping.ts` now compares weekdays instead of dates. Mobile:
`RouteService` mirrors the same change. Backend 222 tests green, web 291, mobile 59.

### TODO-04 `[DONE]` Rework the Rute screen layout
- Not slidable left-to-right. One pane that scrolls **up and down**, that's it.
- Remove the date filter UI: **Data**, **Toate Datele**, **Azi** all go.
- Always display **all routes for a week** in the left pane.
- Remove the **number of Sarcini** — progress already contains that information.
  Leave only progress.
- **Șterge** becomes an icon, not a text button.
- Remove the **Șofer** column/field as it exists now. Instead: tapping the
  driver's name should let you choose/assign that driver to the route.

**Done.** The `Data` column became `Ziua`; the date filter, *Toate datele* and
*Azi* are gone (along with their `t`/`a` keyboard shortcuts); the `Sarcini`
count column is gone because progress already carries it; `Șterge` is now an
icon button; and the driver's NAME is the control that opens the picker, so the
separate `Șofer` action button is gone. Horizontal scrolling was removed in
`DataTable` itself (`overflow-x-hidden`) rather than only on this screen —
a sideways-sliding table hides columns behind an edge nobody expects.

**Not done here:** "always display all routes for a week" is currently "all
routes, unfiltered by date" — which is the same thing while every route is
weekly, but if a week-window selector is wanted later it is a separate change.

### TODO-05 `[DONE]` Change the driver on a route
Exists in the mobile app; needs an equivalent (probably directly on the Rute
screen). Use case: a driver is off sick and someone covers for them.
Two operations:
1. Swap the driver assigned to a whole route.
2. Move some tasks from one route to another driver's route.
*Note:* user recalls ~90% of the mobile feature — check
`mobile/app/Technical/ChangeDriver.tsx` for the real behaviour before designing.

**Done, both halves, on the Rute screen.**
1. Swapping a route's driver: the driver's NAME in the routes table is now the
   control that opens the picker (came with TODO-04).
2. Moving individual stops: each stop on the selected route has a **Mută**
   action opening a route picker, which excludes the current route. It reuses
   the existing `reassignTasks` mutation — the same `PUT /tasks/reassign` the
   mobile ChangeDriver screen calls.

### TODO-06 `[DONE]` Remove the "Asignează" button on unassigned tasks
Tasks in **Neasignate** currently have an *Asignează* button. Remove it — it
gives no control over *which* route or *which* position the task lands in.

**Done.** The button and the `RoutePickerModal` it opened are both gone.
Dragging a task onto a specific slot remains the way to assign, which is the
only route that actually says where the task lands.

### TODO-07 `[DONE — needs your eyes]` BUG: drag-and-drop from "Neasignate" assigns on a nudge
Picking up an order from *Neasignate* and moving it even slightly assigns it to
a route — apparently to the first valid drop slot — even when it is put back
where it started. Needs a proper fix, including the drag animation.
**Cause found (read from the code, not observed).** `DndContext` used
`closestCenter`, which returns the nearest droppable **regardless of where the
pointer actually is**. So nudging a card past the 5px activation threshold and
dropping it back still resolved to a drop target, and the task landed on the
route at whichever slot was closest — there was no way to pick something up and
change your mind.

**Fix applied, three parts:**
1. Collision detection is now `pointerWithin` with a `rectIntersection`
   fallback, so only a droppable the pointer is genuinely over counts. Drop in
   dead space → `over` is null → nothing is written.
2. Pointer activation distance raised 5px → 8px, so a wobbly click cannot start
   a drag.
3. `handleDragEnd` now refuses a drop whose target is not a real position on the
   selected route, instead of silently appending to the end.

**Still needs visual confirmation** — this was fixed blind. The animation
polish the request also asked for was NOT attempted for the same reason.
See OQ-2.

---

## C. Sarcini (tasks)

*Task status, the Sarcini screen, and the `/api/tasks/**` surface.*

### TODO-08 `[DONE]` Task status is driver-owned
Statuses are **Nou**, **În curs**, **Finalizat**.
- Only the **driver** changes them: they mark *În curs* when they start, and
  finishing the photo upload effectively completes the task.
- For web users this is a **read-only status feed** — they observe progress,
  they do not set it.
*Related:* backend already restricts `PATCH /api/tasks/*/status` to the
assigned driver (TaskAccessPolicy).

**Done.** THREE web controls let the office set status, not two — the third was
missed on the first pass and caught by the user:
1. the Status dropdown in `TaskDetailDrawer`,
2. the bulk "Schimbă statusul…" picker on `TasksPage`,
3. `InlineStatusSelect`, an inline editor in the Sarcini table's Status column
   (now a read-only `TaskStatusBadge`; the component is deleted).

The status BADGE stays everywhere, so the web still observes progress — it just
cannot write it. The filter dropdown ("Toate statusurile") stays too: filtering
is not writing. The mutations themselves (`useUpdateTaskStatus`,
`useUpdateManyTaskStatuses`) are left in `queries.ts`, since status legitimately
changes from mobile.

**Regression guard:** `__tests__/statusIsReadOnly.test.ts` fails if any file
under `src/features` (outside `queries.ts`) calls a status-write hook. Added
precisely because the control kept reappearing in new places.

### TODO-09 `[DONE]` Better date filters on Sarcini
Today there is a quick filter for **Azi**. Add:
- A custom **interval** (from → to).
- **Săptămâna Asta** (current week).
- **Săptămâna Urmatoare** (next week).

**Done.** The single `Data programată` picker became an inclusive **De la /
Până la** range, with `Azi`, `Săptămâna asta`, `Săptămâna urmatoare` and `Toate
datele` presets, plus a `w` shortcut for the current week. New `weekStartIso` /
`weekRange` helpers live in `technical/utils.ts` and are covered by 5 tests —
weeks start **Monday**, matching `Route.dayOfWeek` and dodging the JS
`getDay()` Sunday-is-0 off-by-one.

### TODO-34 `[DONE]` `/tasks/order/{id}/exists` returns one task, but the guard rolls up all of them
`GET /api/tasks/order/{orderId}/exists` returns
`taskService.getTaskByOrderId(orderId).orElse(null)` — a **single** task. The
web's `isOrderFulfilled` reads exactly that one status to decide Curente vs
Arhivă. But `OrderRepository.findLiveBySubscriptionId`, the backend guard that
is supposed to be **the same rule**, is
`NOT EXISTS (SELECT t ... AND t.status = 'COMPLETED')` — a roll-up over **every**
task of the order.

For an order with two tasks, one COMPLETED and one NEW, they disagree: the
backend sees a COMPLETED task and stops blocking the subscription delete, while
Comenzi may still show the order as current because `/exists` handed it the NEW
one. Today orders appear to produce one task each so the answers coincide, and
**nothing enforces that**.

Fix by making `/exists` return the summarised status, or by adding a batch
endpoint (`GET /api/tasks/order-status?ids=…`), which would also collapse the
current one-request-per-order fan-out on Comenzi.

*This is the concrete drift TODO-20 and TODO-21 warned about when they said the
two definitions must stay identical.*

**Done, by summarising server-side — not by adding the batch endpoint.** The two
options in this item are not equivalent: the roll-up is the correctness half and
the batch endpoint is the performance half, so only the first is done here. The
fan-out is now TODO-43.

`TaskService.summariseOrderTasks(List<Task>)` is the one rule, and
`TaskController`'s `/exists` calls it: **a COMPLETED task wins whenever one
exists**, whatever the others say — the same question `findLiveBySubscriptionId`'s
`NOT EXISTS` answers. With none completed the order is unfinished either way, and
the task reported is the earliest scheduled one (unscheduled last, ties by id) so
the same order always summarises to the same task. The response shape did not
change, so `normalize.ts` and every caller are untouched; `contract.ts` now
documents `status` as a roll-up, and the mock summarises identically in
`web/src/mocks/index.ts`.

**The single-task assumption was in three places, not one**, all of them through
`TaskRepository.findByOrder_Id`, which returned an `Optional`:

- the endpoint — the drift this item is about;
- `OrderService.deleteOrder` and `ClientService.deleteClientCascade`, which
  deleted **one** task and then deleted the order, so the remaining tasks would
  have failed that delete on their FK — and their photos would have been orphaned
  in Spaces.

The `Optional` was worse than ambiguous: Spring Data throws
`IncorrectResultSizeDataAccessException` — a 500 — as soon as a second task
exists. The finder is now `findAllByOrder_IdOrderByIdAsc` and the Optional one is
gone, so the assumption cannot be re-made silently.

**None of it was reachable today**, and that is the point: `createTaskFromOrder`
is the only code that sets `Task.order` and it refuses a second task per order
(*"Această comandă are deja un task asociat"*) — which is exactly the "nothing
enforces that" this item flagged. The rule now holds without depending on it.

**Verified:** `./gradlew test` — **253 tests, 0 failures** (was 241; +12 = ten
golden cases from TODO-41 and two `TaskControllerTest` cases for an order with
several tasks). Web: lint 0 errors, typecheck clean, build clean.

### TODO-42 `[DONE]` `/tasks/order/{id}/exists` is not row-scoped
Found while doing TODO-34, and left alone because it is an authorization decision
rather than part of that fix.

The endpoint made **no `TaskAccessPolicy` call**. `SecurityConfig`'s matrix lets
any authenticated employee read `/api/**`, so a driver-only account could ask about
**any** order id and learn its task's id, route, schedule and status — the same
class of leak `TaskScopingTest` exists to prevent for `/api/tasks/employee/{id}`.
It is a summary of one order rather than a list, so the exposure is small and
needs an id to aim at.

**Decided office-only** (`accessPolicy.requireOfficeRole`), not a driver-scoped
policy method, on the evidence that **no driver screen asks this question**. Every
caller is an office screen: web's `features/sales` (`useOrderTaskStatuses`, used by
`OrdersPage`, `OrderDetailDrawer`, `DayOrdersDrawer`, `OrderFormDrawer`) and
mobile's `app/Sales/` + `app/Technical/` (`TaskService.checkOrderHasTask`). Nothing
under `mobile/app/Driver/` calls it — the driver app reads its day through
`/api/tasks/mine` and makes exactly the two writes the matrix lists. A row-scoped
rule would have been a guard with no caller to serve.

The guard also runs **before** the lookup, so a refused probe cannot be told apart
from a missing order — scanning ids teaches a driver nothing.

Three cases in `SecurityTests/TaskScopingTest` against the real filter chain
(driver refused even for an order carrying their OWN task, driver refused for an
unknown id, office still reads it and sees the task id). Not in the controller
slice: that runs `addFilters = false` with a mocked policy and proves nothing.

### TODO-43 `[DONE]` Comenzi asks for one order's task status per order
Split out of TODO-34, which fixed the correctness half and deliberately did not
touch this one.

`useOrderTaskStatuses` fans out one `GET /tasks/order/{id}/exists` per order and
`Promise.all`s them, so opening Comenzi with 200 orders is 200 requests. Mock mode
hides it (in memory, one shared latency) and so does a small dataset.

TODO-34's other option — `GET /api/tasks/order-status?ids=…` — is the fix, and it
is now purely a performance change: the roll-up already lives in
`TaskService.summariseOrderTasks`, so the endpoint is a loop over it plus a
contract method, a mock and one query key. Needs deciding: a query-param id list
(cheap, but URL length caps the page size) or a POST body (no cap, a POST that
reads, and a new `SecurityConfig` row because writes need OFFICE).

**Built, together with TODO-52 — they are one piece of work.** Shipping the
endpoint without the guard would have been a security regression, not a
half-finished feature, so both are closed here.

**Decided: the query-param id list, with an explicit cap and a chunking client.**
A POST that reads is worse on both counts that mattered. It is the wrong verb for
a read, and — the part that actually decided it — it would land under the OFFICE
write matcher, which means the authorisation would come from a rule about
*writes*, hiding a decision this endpoint has to make on purpose. GET keeps that
decision visible as the `requireOfficeRole` call TODO-52 asks for.

The cost of GET is the URL cap, and it is handled rather than hoped away:
`MAX_ORDER_STATUS_IDS = 500` (Tomcat's default header limit is 8 KB), **a 400
beyond it, never a silent truncation** — a short map reads as "these orders have
no task", which is exactly what the Curente/Arhivă split decides on. The web
client chunks at 200 and `Promise.allSettled`s the chunks, so one failed chunk
leaves the rest of the column populated instead of blanking it.

**Every requested id gets an entry, including orders with no task.** An absent
key would read as "no task" by accident; making it explicit means absence never
stands in for an answer. Two tests pin it, one per side.

`statusForOrder` is kept although no screen calls it now: it is still a live
backend endpoint mobile uses, and `contract.test.ts` measures the batch form
against it id by id — if those two ever disagree, Comenzi would mean different
things depending on how it happened to fetch.

Covered by four `TaskScopingTest` cases (a driver is refused even for their own
order, and even for one id) and three `contract.test.ts` cases.

### TODO-52 `[DONE]` The batch order-status endpoint in TODO-43 needs TODO-42's guard
Recorded while closing TODO-42 so it is not re-learned later.

TODO-43 replaces the per-order fan-out with one batch endpoint
(`GET /api/tasks/order-status?ids=…` or a POST body). Whichever shape wins, it
answers **the same question for many ids at once**, so it inherits TODO-42's
answer and needs `accessPolicy.requireOfficeRole(principal)` in the controller —
a batch version without it is strictly worse than the leak TODO-42 just closed,
since one request would enumerate the whole order space instead of probing one id.
The matcher row does not do this: reads are open to any authenticated employee by
design. Add the `TaskScopingTest` case alongside it.

**Done with TODO-43, as one change.** `TaskController.orderTaskStatuses` opens
with `accessPolicy.requireOfficeRole(principal)`, before it looks anything up, so
a refused probe cannot be told apart from a missing order. Four
`TaskScopingTest` cases cover it: a driver refused for two ids, refused for a
single id, refused **even for the order carrying their own task** — the case that
shows this is office-only rather than row-scoped — and office staff still reading
it. The GET shape was chosen partly so this guard stays a visible line of code
rather than a side effect of the OFFICE write matcher; see TODO-43.

---

## D. Comenzi (orders)

*Orders, the calendar, and the Abonamente / Produse catalogues behind them.*

### TODO-10 `[DONE]` Map picker when choosing a location on an order
Choosing the location while creating an order should work like the mobile app:
type an address, use search, **and then drag the pin** to get exact
coordinates.
*Note:* mobile does this in `LocationPicker`; that one deliberately does NOT go
through `apiFetch` (it would leak the bearer token to Google).

**Done, then reworked after testing.** `Alege pe hartă` sits under the
address/coordinates pair in `LocationFields`, so it covers all three order types
at once. The dialog is `sales/components/LocationPickerModal.tsx`.

#### What was wrong on the first pass (reported: blank map, pin stuck in the middle)

**1. The map was a blank white box.** The map container was positioned with
Tailwind's `absolute inset-0`. MapLibre stamps its own `.maplibregl-map` class
onto whatever element it is given, and `maplibre-gl.css` declares
`position: relative` on that class. Same specificity, loaded later, so it wins:
the container silently went back to `relative`, `inset-0` stopped applying, the
div collapsed to height 0, and MapLibre initialised a zero-height viewport. A
zero-height viewport needs no tiles, so nothing was ever requested and no error
was raised anywhere — while the camera kept reporting perfectly correct
coordinates, which is exactly why search "worked" on a map that showed nothing.

`MapCanvas` had already hit this and fixed it with inline
`style={{ position: 'absolute', inset: 0 }}` (inline styles outrank both
stylesheets), and carries a comment explaining why. The picker was written
afterwards and did not carry the fix across. It does now, with the same comment.

The picker also had no failure state, which is what let a broken map look like
an empty one. It now shows *"Se încarcă harta…"* until MapLibre fires `load`,
and *"Harta nu s-a putut încărca"* if that has not happened in 20 s — same
timeout and same "never fail on an `error` event" stance as `MapCanvas`, where
routine startup errors had previously produced a permanent failure screen over a
tile host that was answering fine.

**2. The pin is no longer fixed to the centre of the viewport.** The first
version copied the mobile crosshair model: the pin was an overlay at the middle
of the map and the confirmed point was always `map.getCenter()`. That means
panning to look around rewrites the answer. It is now a real MapLibre `Marker`
on the ground: **click anywhere to drop it, drag it to fine-tune, pan freely
without touching the point.** The marker is built as DOM (`createPinElement`,
node by node rather than `innerHTML`) because MapLibre owns its positioning.

Because the pin is explicit now, a search result also *places* it, at the
geocoder's own coordinates, instead of only flying the camera; and the initial
"opened on an address with no coordinates" lookup drops the pin on the first
result rather than leaving the operator with nothing to adjust.

#### Behaviour as it stands

Three things fill the value: a **known place** (this client's sites in brand
colour, everyone else's in grey, numbered — clicking one snaps to its exact
stored coordinates and its stored address), an **address search**, or a
**click/drag on the map**. Only the hand-placed pin triggers reverse geocoding;
a search result and a known place come with a better label than a reverse lookup
would invent, and re-labelling them would overwrite the operator's choice with
something rounder. Every geocoder failure degrades to "keep the old label"
rather than an error: the coordinates under the pin are the real output, and
they keep working offline.

**Geocoder: Photon (`lib/geocoding.ts`), not Google.** No API key, no billing,
built for as-you-type autocomplete — which Nominatim's usage policy forbids —
and OSM-derived like the OpenFreeMap tiles the map screen already draws, so a
result and the street it lands on come from the same data. Mobile keeps Google
Places: it has a key provisioned through `app.config.js` already, and putting a
billed key into a public SPA bundle to match would be a step backwards. Like
mobile's, the call does NOT go through the app's fetch wrapper — that would
attach our bearer token to a third party's host.

The picker is behind `React.lazy` so MapLibre (~250 kB gzip) stays out of the
Comenzi chunk for the operators who never open it;
`__tests__/mapPickerIsLazy.test.ts` fails if a static import creeps back in.
`__tests__/LocationPickerModal.test.tsx` covers the new model (click drops the
pin, drag re-labels it, a search sets both halves, a known place is never
reverse-geocoded) against a faked MapLibre, since jsdom has no WebGL.

**Lesson worth keeping:** a map that renders nothing but whose coordinates are
right is almost always a zero-sized container, not a network problem — and any
CSS a third-party stylesheet also sets on the container has to be inline.

### TODO-11 `[DONE]` Remove Activ/Inactiv from Abonamente
Drop the active/inactive concept and its UI for subscriptions. It is
effectively the client's product catalogue — there is no sensible reason for
entries to be inactive.

**What `isActive` actually was:** not a status and not a usage indicator, but a
**soft-delete flag**. `DELETE /api/subscriptions/{id}` never deleted anything —
it set `isActive = false` so the plan stopped appearing in new-order dropdowns
while old orders referencing it kept resolving.

**Done — UI removed, mechanism kept (option A).** Gone: the Toate/Active/
Inactive tabs and their counts, the `Stare` column, and the Dezactivează/
Reactivează toggle. The list now shows only live plans, and deleting one
retires it exactly as before. The flag stays in the model because old orders
point at these rows and there is no migration tool — hard-deleting would break
them irreversibly.

### TODO-12 `[DONE]` Calendar view next to Comenzi
A big calendar laid out like an advent calendar ("Christmas sweets" style):
- Each day cell shows a summary of that day's information underneath the date.
- Clicking a day opens all orders for that day.
*Blocked on:* OQ-1 — needs the order/task distinction settled first.

**Done — web only.** No backend, mobile, API-contract or mock change: the screen
reads the orders the app already fetches. New `Calendar` entry under **Vânzări**,
directly under Comenzi, at `/calendar` (`g d`, and in ⌘K), lazily loaded like
every other screen — its own 8.2 kB chunk, so Comenzi does not carry it.

**The grid** (`features/sales/components/MonthGrid.tsx`) is one chunky tile per
day, Monday-first, whole weeks only — five rows or six, never a blank trailing
one. The date is the lid; underneath it the day's summary: a total pill plus one
line per order type present that day (`2 Amplasări`, `1 Ridicare`), colour-dotted
to match `OrderTypeBadge`. Today gets a brand ring, weekends a tint, the adjacent
months' borrowed days recede. **Only a day that holds orders is a button** — an
empty day is a plain div, because putting the month's ~20 empty days into the tab
order buries the one busy Thursday a keyboard user is looking for.

**OQ-1 is settled by scope, not by renaming anything.** A cell counts **orders**,
because this is the Vânzări view of what was sold and when it is due. A `Task` is
the driver-facing execution of an order; it lives on a **weekly** route
(TODO-03), so it has no Sales-owned calendar date to plot. The distinction still
surfaces where it is actionable rather than academic: every order in the day
panel carries its task status, and a red **Neprogramat** when no task covers it
yet — which is exactly the "sold but nobody is going" case the office needs to
see. Dispatch keeps answering "which rows, which day, which driver" on Rute and
Sarcini.

**Which day an order lands on:** `orderPrimaryDate`, the same definition Comenzi
already sorts and filters on — start date / pickup date / sanitation date. So an
Amplasare sits on the day the cabins go out, **not** on every day of its rental
window: the window is a contract, the placement is the work, and spreading it
would report a 60-day rental as 60 days of work. Reusing the one definition is
the point — a second one that disagreed would show an order in the table and hide
it in the calendar. The day panel still spells out the full window per order.

**Clicking a day** opens `DayOrdersDrawer`, the same slide-over shape the rest of
Sales uses, listing that day's orders (number, type, client, what was ordered,
address, window, task status). Picking one hands off to Comenzi through the
existing `?comanda=<id>` deep link, so the calendar never becomes a second place
to edit an order. Task status is fetched **there**, not on the page: the query
fans out one `GET /tasks/order/{id}/exists` per order (there is no batch
endpoint), so it should cover the ~5 orders of the opened day, not the ~120 of
the month.

Also added: `?zi=YYYY-MM-DD` opens a day directly (a shareable link to a day, the
trick `?comanda=` plays for an order) — which is why `useDeepLink` grew a `raw()`
alongside `number()`/`flag()`; a type filter and `‹ › Azi` month stepping; `t` for
the current month and `r` to refetch; and `orderCountLabel` in
`components/domain.tsx`, which gets the Romanian **"24 de comenzi"** rule right
where an English pluraliser would write "24 comenzi".

**Tests: 25 new, web suite 345 → 348 files-green.** `calendar.test.ts` (17) pins
the arithmetic that actually breaks month views — Monday-first padding, the
31-day → 28-day step, whole weeks, the 25-hour DST night in October, and orders
with no date being dropped rather than given one. `MonthGrid.test.tsx` (5) pins
the tile contract, including empty days staying out of the tab order.
`CalendarPage.test.tsx` (3) mounts the real screen against the mock API and opens
a day, because **the browser access OQ-2 asks for still does not exist** — this
was built without ever looking at it, and a mount-level test is the honest
substitute for eyes. Lint 0 errors, typecheck clean, bundle budget 139.3/160 kB.

**Deliberately not built:** drag-and-drop rescheduling (moving an order's date is
an edit, and edits live in the order form), a week/day zoom, and any task layer.

*Note for TODO-21:* when fulfilled orders move to an Arhivă, the calendar's
month total is a second place that will start counting them differently — it uses
`orderPrimaryDate`, not `deriveLifecycle`.

### TODO-20 `[DONE]` Block deleting a subscription that live orders still use
Today a plan can be retired while orders still reference it. Instead, deleting
should be **refused** until those orders are either fulfilled or deleted — or
until they are moved onto a different subscription.

Needs deciding:
- What counts as "still in use" — any referencing order, or only unfulfilled ones?
- Does the UI offer a bulk "move these orders to another plan" action, or just
  refuse and list the blocking orders?
- Same question for Produse, which likely has the identical exposure.

*Context:* this is what makes TODO-11's soft-delete flag safe to keep. The flag
protects old orders from dangling; this rule stops new dangling references being
created in the first place.

**Done.** `DELETE /api/subscriptions/{id}` now answers **409** with a Romanian
message while anything live still points at the plan, and the Abonamente screen
explains the refusal by naming the blockers instead of toasting a failure.

**The three open questions, decided:**

**1. "Still in use" = not finished — and that follows from the delete being
SOFT.** The two guards in this repo are now deliberately different rules,
because they protect against different damage:

| | Delete is | Blocked by |
|---|---|---|
| Abonament | soft (`isActive = false`, row survives) | only **unfinished** work |
| Produs | **hard** (row is gone) | **any** referencing order |

A finished Igienizare keeps resolving through a retired plan, so it has no
business blocking one — that *is* TODO-11's mechanism. A deleted product leaves
nothing behind, so even a completed order would dangle. Same question, opposite
answers, for a reason.

"Finished" means **a COMPLETED task and nothing else.** An order with no task
has certainly not been carried out, so it still blocks even when its date is
long past. This is deliberately stricter than `deriveLifecycle`, which will call
a task-less past-dated order `'done'` from its date alone — fine for colouring a
map pin, wrong for a guard, which has to fail safe. **TODO-21 must adopt this
same rule** rather than reusing the date fallback, or the archive and the guard
will disagree about the same order.

**2. Refuse and list — no bulk move.** `SubscriptionUsageModal` names every
blocking order (number, client, date) and links each one through to Comenzi via
`?comanda=<id>`, so the refusal ships with the way to resolve it. A bulk "move
these to another plan" would be a sweeping write the operator asked for only
obliquely by pressing Delete; it stays unbuilt on purpose.

**3. Produse already had this guard — and it was half-built.** `ProductService`
checked `AmplasareOrder.product` only, so a product used **solely by a Ridicare
order** could be hard-deleted, leaving that order pointing at a row that no
longer existed. Now both order types are checked. The mock had been checking
both all along, so mock and live had quietly disagreed about this since they
were written.

**Recurring plans block too, and block harder.** An ACTIVE `RecurringIgienizare`
on the plan refuses the retire even when no order is outstanding: it keeps
generating fresh orders against that subscription every night
(`RecurringTaskScheduler`, 02:00), which is precisely the new-dangling-reference
this item exists to prevent. They are listed but NOT linked — Igienizări
recurente is a Tehnic screen and a Vânzări-only account would land on "acces
interzis".

**New endpoint: `GET /api/subscriptions/{id}/usage`**, an advisory preflight so
the UI can explain the refusal *before* the operator commits, rather than after
a failed action. It changes nothing about who is allowed to do what: a GET under
`/api/**` already resolves to "any authenticated employee" in `SecurityConfig`,
so **no new matrix row** — and no `TaskAccessPolicy` call, since it is neither
task-shaped nor employee-scoped. The DELETE remains the actual gate; the
preflight failing just falls through to the normal confirm, and a 409 lost to a
race re-fetches usage so the operator still gets the list.

**UPDATE (while doing TODO-15/16/21): the owed backend build has now been run.**
`cd backend && ./gradlew build` on JDK 21 — **BUILD SUCCESSFUL, 232 tests, 0
failures**. The 11 new/changed backend tests from this item ran for the first
time and passed, and the `@Query` in `OrderRepository.findLiveBySubscriptionId`
loads at context startup. Nothing below is outstanding any more; it is kept for
the record.

**Verification is uneven, and the backend half is the weak one:**

- **Web — fully verified.** 360 tests green (was 350): 6 new contract tests
  proving the mock refuses exactly what live refuses (including that a NEW task
  does *not* unblock, and that COMPLETING the last order does), plus 5 on the
  dialog. Typecheck clean, lint 0 errors, build clean, bundle 139.7/160 kB.
- **Backend — WRITTEN BUT NEVER COMPILED.** This machine has no JDK 17+ (only a
  Java 8 JRE) and no Docker, so Gradle cannot even load the Spring Boot plugin.
  The 11 new/changed backend tests have never run. **`cd backend && ./gradlew
  build` on a machine with JDK 21 is still owed** — in particular it is what
  would catch a malformed `@Query`, which fails at context startup rather than
  at compile time.

### TODO-21 `[DONE]` Archive fulfilled orders out of Comenzi
**Comenzi should show only current orders.** Fulfilled ones move to a separate
**Arhivă** view — same UI shape as the old Active/Inactive split on Abonamente,
just applied to something that genuinely has a lifecycle.

*Why this is not the thing TODO-11 removed:* on Abonamente the flag was a
soft-delete masquerading as a status, so surfacing it was a lie. "Fulfilled" is
a real state an order actually reaches, so a split view is the honest shape
here. Don't "clean this up" later by analogy with TODO-11.

Needs deciding:
- **Derived or stored?** `deriveLifecycle` in `web/src/features/map/data.ts`
  already computes `'done'` from the order's tasks — all COMPLETED means done,
  with date reasoning as the fallback when an order has no tasks. Reusing it
  means no new state to keep in sync; a stored flag would be cheaper to filter
  on but can drift from the tasks it is supposed to summarise. **Prefer reusing
  the existing derivation** — a second definition of "done" that disagrees with
  the first is the failure mode here.
- Where the derivation should live if both Sales and the map need it (today it
  sits in the map feature).
- Whether archived orders are read-only, and whether anything can un-archive.

**Shares its definition with TODO-20.** "Live orders that block deleting a
subscription" and "current orders that stay out of the archive" are the same
question — decide once, implement once, or they will drift apart.

**Done (web only — no backend or mobile change).** Comenzi now opens on a
`Curente` / `Arhivă` tab strip, both drawn from the same table; the counts on
the tabs are of the *filtered* set, so a search says how many of its matches are
finished.

**The three open questions, decided:**

**1. Derived, and from TODO-20's rule — not from `deriveLifecycle`.** The split
is `isOrderFulfilled` in `web/src/features/sales/orderModel.ts`: **a COMPLETED
task, and nothing else.** No stored flag, so there is nothing to keep in sync
and nothing that can drift from the tasks it summarises. It deliberately does
NOT reuse `deriveLifecycle` from `features/map/data.ts`, per TODO-20's decision:
that one falls back to date reasoning and calls a task-less past-dated order
`'done'`, which is fine for colouring a map pin and wrong here — an order nobody
ever executed would vanish out of the operator's list because a date rolled
over. A status that is missing or still loading also reads as unfinished: an
order only leaves Comenzi on positive evidence.

**2. It lives in `orderModel.ts`,** which is the shared place already — the map
feature imports from it, so the map can adopt the same rule later without a new
module. `deriveLifecycle` stays where it is and keeps its date fallback; the two
now answer different questions on purpose, and each says so in its own comment.

**3. Nothing archives or un-archives by hand, and archived orders are not
read-only.** There is no button, because the state is derived: an order leaves
Arhivă exactly when its task stops being COMPLETED (a driver reopening it),
which is the only thing that could honestly un-archive it. The detail drawer
still edits and deletes from the archive — correcting a typo on finished work is
ordinary, and a lock nobody asked for would be a new permission concept. A
`?comanda=<id>` deep link to a finished order switches to Arhivă, so the row
behind the drawer is the one the link named.

**Verified:** 355 web tests green (349 + 6 new: 3 on the split against the mock
API, 3 on the rule itself), typecheck clean, lint 0 errors, build clean.

*Related:* OQ-1 — archiving depends on knowing when an order is finished, which
depends on the order/task relationship being clear.

### TODO-37 `[DONE]` Bulk-move orders between subscriptions
When TODO-20 refuses a delete, the only way forward is to finish or delete each
blocking order one at a time. Offer *"Mută pe alt abonament"* in the refusal
dialog: reassign the listed orders to a chosen plan, then retry.

`SubscriptionService.deactivate`'s javadoc already records that this was
deliberately left out — "that would be a write the operator did not ask for" —
so this item is the considered follow-up, not a contradiction.

Needs a backend endpoint and a decision on whether reassigning is allowed for
orders whose tasks already carry the OLD plan name in `Task.productName`: the
name is copied onto the task, so moving the order does not move history.

**Built. `POST /api/subscriptions/{id}/orders/move`** with body
`{targetSubscriptionId, orderIds}` → `SubscriptionService.moveOrders`, plus the
*Mută pe alt abonament* section in `SubscriptionUsageModal`.

**The `Task.productName` decision: the tasks move too, and no history is
rewritten.** Those turn out not to be in tension. `productName` is a COPY of the
plan name taken when the task was generated, so a move that ignored it would send
a driver out with the old plan on their screen. But **only orders with no
COMPLETED task can move at all** — the same strict `NOT EXISTS` as
`findLiveBySubscriptionId`, deliberately, or this method and the guard it exists
to unblock would disagree about the same order. A movable order therefore has no
completed task, so "update every non-COMPLETED task" rewrites nothing that
records work actually done. The COMPLETED check on the task loop is belts and
braces, and says so.

Finished orders are also simply not blockers, so moving them would buy nothing.

**Other decisions made while building it:**

- **`orderIds` is required — no "move everything on this plan".** Between the
  dialog opening and the button being pressed, a new order can land on the source
  plan, and sweeping it along is exactly the write-nobody-asked-for that kept
  this out of `deactivate`. The server recomputes the live set and refuses the
  **whole** call if any requested id has stopped being live since. All-or-nothing:
  a half-move leaves the plan still un-retirable and the operator with no idea
  which half went.
- **It takes the TARGET plan's row lock and re-checks `isActive`** — this
  attaches work to a plan, so it is one of the writes TODO-39 is about. The
  source is not locked: emptying a plan can only help a concurrent retirement of
  it, and locking both would invite a deadlock between two operators moving
  orders in opposite directions.
- **Recurring plans get no move button.** Moving one keeps it generating orders
  against the plan being retired. When they also block, the dialog says the
  delete will still fail rather than promising something it cannot deliver.
- **The move retries the delete automatically**, with no second confirm — the
  operator pressed Delete, not "reorganise my orders", and they confirmed once
  already. `attemptDelete` was split out of `remove` so both paths share the
  409-re-ask.

**Refactor it forced, worth naming:** "a retired plan takes no new work" existed
twice, in `OrderService` and `RecurringIgienizareService`, with per-context
wording. Adding a third copy would have been the drift this repo keeps warning
about, so it is now one `SubscriptionService.requireUsablePlan(plan, forWhat)`
with all three delegating to it.

Covered by 8 cases in `SubscriptionServiceTest` (including that it takes
`findByIdForUpdate` and not a plain read) and 5 new ones in
`SubscriptionUsageModal.test.tsx`. The web mock enforces every refusal the
backend does, with the same Romanian text, so the UI's error path is not
first exercised in production.

### TODO-38 `[DONE]` Produse deletion: hard delete, incomplete check, its own error format
Investigated alongside TODO-20 and found **materially different from
Abonamente**, so it deliberately did NOT get the same treatment — applying
TODO-20's rule here would be a regression. Three problems in
`ProductService.deleteProduct` / `ProductController.deleteProduct`:

- **(a)** `existsByAmplasareOrderProductId` only checks `AmplasareOrder.product`.
  **`RidicareOrder.product` is never checked**, so a product used only by
  Ridicări can be destroyed, leaving a dangling FK. *Small fix, real bug.*
- **(b)** It is a **hard** delete, not a soft one. That is why its strict "any
  referencing order blocks" rule is *correct* and must not be relaxed to
  TODO-20's "only unfulfilled orders block" — destroying a product that
  fulfilled orders still reference is exactly the dangling reference the
  subscription soft-delete exists to prevent. Adopting the friendlier rule needs
  an `isActive` flag on Produse first. **This is the real decision.**
- **(c)** `ProductController` catches `IllegalStateException` itself and returns
  `409 {"error": …}`, bypassing `GlobalExceptionHandler` — the only place in the
  app where the error body's message lives under `error` rather than `message`.

**All three done. The decision on (b): soft delete, matching Abonamente.**

The complaint the item names is real and only a soft delete fixes it — under a
hard delete, a product sold once years ago blocks its own removal forever, so the
catalogue can only grow. `Product.isActive` now exists, `deleteProduct` sets it
false, and the rule relaxes with it: **only UNFINISHED orders block**, the same
strict `NOT EXISTS (task COMPLETED)` as `findLiveBySubscriptionId`, via a new
`OrderRepository.countLiveByProductId` that counts BOTH order types. Produse and
Abonamente are one rule now, where they were deliberately two.

**The trap in doing it, and the thing to not undo:** `is_active` is **nullable,
and null MEANS ACTIVE.** There is no migration tool — `ddl-auto=update` adds the
column to a populated table and therefore cannot make it NOT NULL, so every row
that already existed reads back null. A plain `findByIsActiveTrue()` would have
returned NOTHING on the deploy that introduced the column, emptying every product
picker in all three apps. The query is `IS NULL OR = true`, the Java side reads
it through `Product.isRetired()` (`Boolean.FALSE.equals`, false for null), and
`normalizeProduct` does `?? true`. Three tests pin it, one per layer.

**(a) was already fixed** before this pass — `existsByRidicareOrderProductId` was
being checked. The item's text was stale. `countLiveByProductId` covers both
types anyway.

**(c) is subtler than "rename the key".** The bespoke body put the Romanian text
under `error`; `GlobalExceptionHandler` puts the HTTP status REASON under `error`
("Conflict") and the text under `message`. So simply deleting the try/catch would
have made every client that read `error` show the user the word **"Conflict"** —
`mobile/services/ProductService.deleteProduct` did exactly that and is fixed to
read `message`. `ProductControllerTest` now asserts both keys, so nobody
re-introduces the confusion. The web client never read either key, which is
TODO-51's separate problem.

**Also added:** `GET /api/products/all` and `products.listAll()`, mirroring
subscriptions, so a management view can still see what an old order points at.
`GET /api/products` is now active-only, which is what makes a retired product
vanish from the pickers in all three apps.

The web mock enforces the new rule with the same Romanian text, and
`contract.test.ts` gained a Produse block mirroring the Abonamente one — including
that a COMPLETED task releases the product, and that a retired product leaves
`list()` but stays in `listAll()`.

### TODO-57 `[DONE]` Produse has no "what is still using it" dialog
Found while doing TODO-38. Retiring a product is now refused the same way
retiring a subscription is, but the two refusals are not equally useful.

Abonamente has `GET /api/subscriptions/{id}/usage` and
`SubscriptionUsageModal`, which name every blocking order and link each one
through to Comenzi. Produse has a counted message and nothing else: *"Nu se poate
șterge produsul: 3 comenzi nefinalizate îl folosesc încă."* — the operator's next
question is always *which* three, and there is no way to find out but to search
Comenzi by hand.

Not built here because TODO-38 asked for the delete rule, not a second dialog,
and the parallel is worth building deliberately rather than by copy-paste. What
it needs: a `ProductUsageResponse` alongside `SubscriptionUsageResponse`,
`GET /api/products/{id}/usage`, and a modal — most likely one component
parameterised over both, since the two would otherwise be the same JSX twice.

The bulk move from TODO-37 has **no** product equivalent and probably should not:
moving an order to a different product changes what is physically delivered,
which is a real decision per order, not a bulk one. Say so if this is picked up.

**Done, and the bulk move was left out for exactly that reason** — said in the
code, in `ProductUsageModal`'s header, so the next person does not read its
absence as an oversight.

Backend: `ProductUsageResponse`, `OrderRepository.findLiveByProductId` and
`GET /api/products/{id}/usage`, mirroring the subscription trio. No SecurityConfig
row — it is a GET under `/api/**`, which the matrix already limits to
authenticated employees, and it exposes nothing a driver could not already read
from `GET /api/orders`.

**The list and the count are one predicate, written twice.** `findLiveByProductId`
is `countLiveByProductId` with the rows kept: the count is what refuses the
delete, the list is what the dialog names. Drift between them would show as a
refusal counting three orders opening a dialog that lists two, so
`FulfilmentRuleTest` now runs BOTH against every case in
`shared/fulfilment-cases.json` — each case grows an Amplasare on a product of its
own, carrying the same task statuses as the Igienizare it already had. That also
closes a real hole in the fixture: the product half of the fulfilment rule
(TODO-38) had no golden-case coverage at all.

Web: one component parameterised over both, as the item guessed, but split where
the two dialogs actually differ rather than by a flag. `UsageModal.tsx` holds the
shell and the linked list of blocking orders; `SubscriptionUsageModal` keeps the
bulk move and the recurring plans, `ProductUsageModal` adds the type/date/quantity
label a product needs. Parameterising the subscription-only parts in would have
made the shared component a switch over which caller it had, which is worse than
the duplication it removes.

`ProductsPage` now preflights the usage call before offering the confirm and
re-asks on a 409, the same flow Abonamente uses — the DELETE stays the guard.
The mock enforces the identical rule and counts its refusal off the same
`productUsage()` helper the dialog reads, so mock and live cannot disagree about
which orders block.

**Mobile got nothing**, deliberately: it has no subscription usage dialog either,
so adding a product one would break the parity rather than complete it. If Produse
ever gains one there, both should arrive together.

A stale comment was fixed in passing: `OrderRepository`'s "Deletion guards" header
still described the product delete as HARD and the two rules as different, which
TODO-38 made untrue.

### TODO-39 `[DONE]` Check-then-act on subscription retirement is unserialized
Narrower than the repo-wide "no optimistic locking" gap in *Known gaps*, and
with a cheap local fix, so it earned its own line.

`SubscriptionService.deactivate` read the blockers and then wrote
`isActive = false`. Under READ COMMITTED nothing made that atomic: `POST
/api/orders` could commit a new unfulfilled `IgienizareOrder` for the plan between
the read and the write. That transaction never touched the `subscriptions` row,
so nothing conflicted — no `@Version`, no row lock, no constraint. **Outcome: a
plan retired with a live order pointing at it.** Because the delete is soft the
order still resolved, so the damage was "live order on a retired plan", not a
dangling FK.

Fixed with the pessimistic-lock option (not `@Version` — repo-wide optimistic
locking stays a separate gap). `SubscriptionRepository.findByIdForUpdate` is a
`@Lock(PESSIMISTIC_WRITE)` read of the one row, and **every writer that can
invalidate another's decision takes it before deciding**: `deactivate()` (now
`@Transactional`, which is what gives the lock a transaction to live in),
`OrderService` (create and update), and `RecurringIgienizareService.create` —
that third one was found during the fix and is the stronger writer, since it
commits an ACTIVE recurring plan *and* an initial live order.

**The lock alone was not enough, and that is the part worth remembering.**
Serialising the two only decides who goes second; whoever does still has to
LOOK. `deactivate` re-reads its blockers under the lock, and the creating side
re-checks `isActive` and refuses a retired plan with a Romanian 409
(`IllegalStateException`). Without that re-check, "retirement first, order
second" produced exactly the bug the lock was meant to stop.
`updateOrder` refuses only a **move** onto a retired plan: re-sending the plan an
order already sits on stays legal, because the soft delete exists so finished
orders keep resolving through the surviving row.

Behavioural difference between the engines, since dev/test are H2 and prod is
Postgres: the `for update` clause is emitted and valid on both (verified in the
Hibernate SQL log), but a contended waiter **blocks indefinitely on Postgres and
fails after H2's lock timeout**. So a contended retirement is a wait in prod and
an error locally.

Guarded by `RepositoryTests/ConcurrencyGapsTest` as "GAP 3 (CLOSED)" — real
repositories on H2, both interleavings reproduced deterministically (no thread
race, so nothing flaky), plus a test that the `FOR UPDATE` query actually runs on
H2 — and by unit tests in `SubscriptionServiceTest` / `OrderServiceTest` pinning
that the locking read is the one on the path (`findById` must never be called)
and that `deactivate` stays `@Transactional`.

## E. ID scanning & photo privacy

*The MRZ scanner, and what is and is not stored in Spaces.*

### TODO-13 `[DONE]` Scan an ID to autofill nume complet + CNP
Upload a photo of an identity document and extract **full name** and **CNP**
automatically, filling the form.

**Done, in web and mobile, with no paid API and no network call at all.**

**The decision that made this cheap: read the MRZ, not the card.** Autofilling
these two fields looks like an OCR problem, and as an OCR problem it is a bad
one — the printed fields are proportional type over a guilloche background, in a
layout that changed with the 2021 electronic card, with diacritics. The MRZ is
the same data in the one place designed to be read by a machine: three fixed
30-character lines of OCR-B over a 37-symbol alphabet (`A-Z0-9<`), in the same
position on every ICAO 9303 TD1 document ever issued. Romania puts the **CNP** in
line 1's optional-data field and the **name** is line 3. Both fields we want,
from the easiest tenth of the image.

**Why a free, imperfect engine is good enough — and this is the whole argument.**
Not because the engine is accurate. Because the MRZ checks itself, three
independent ways:

| Check | Catches |
|---|---|
| four ICAO check digits (document number, birth date, expiry, composite) | any misread character in those fields |
| the CNP's own control digit (weights `279146358279`, mod 11, 10→1) | a misread CNP digit |
| the CNP's embedded birth date and sex vs. MRZ line 2, stated independently | a misread that happens to pass both of the above |

So the rule, stated once in `shared/id-mrz-cases.json` and implemented twice:
**autofill ONLY on a fully self-consistent read; otherwise refuse.** A card whose
document number smudged is rejected even though the document number is never
used — a failed check digit means *something* was misread and the parser cannot
say what. Refusing costs the operator two fields of typing, which is what they do
today. A false accept writes a wrong CNP into a client record nobody re-reads, on
a person, under GDPR. The costs are not comparable, so it fails safe.

**Engines, both free and both on-device:**

- **web** — `tesseract.js` (Apache-2.0, WASM). Self-hosted: `scripts/fetch-ocr-assets.mjs`
  copies the LSTM cores and worker out of `node_modules` and downloads the
  `tessdata_fast` English model from a **tagged** ref, verified against a
  SHA-256 recorded in the script. The output is gitignored — a 2 MB binary blob
  committed to a repo is permanent in a way a build step is not (TODO-24 is what
  that lesson cost here).
- **mobile** — `@react-native-ml-kit/text-recognition`, i.e. ML Kit on Android
  and Vision on iOS. On-device, no key, no request, already in the OS.

**Both defaults had to be overridden to keep it private.** tesseract.js defaults
`workerPath`, `corePath` and `langPath` to **jsDelivr** — leaving any of them
unset would put a third party in the request path of an identity-document scan,
arriving through a default nobody wrote down. `ocrIsLazy.test.ts` asserts all
three are set and that the file names no `http` host at all.

**What was built:**

| | web | mobile |
|---|---|---|
| parser | `features/sales/idScan/mrz.ts` | `utils/mrz.ts` |
| engine | `features/sales/idScan/ocr.ts` | `services/IdScanService.ts` |
| UI | `features/sales/idScan/IdScanField.tsx` | `app/Sales/CreateClient.tsx` |

The two parsers are **byte-identical below their doc comments** and pinned
against each other by `shared/id-mrz-cases.json`, which both suites read — the
same arrangement as the fulfilment rule (TODO-41), and for the same reason: a
rule written twice with no shared code drifts silently otherwise.

**Refusals get four different messages, not one.** `format` and `check-digit`
mean retake the photo; `cnp-invalid` and `cnp-mismatch` mean the card *was* read
and disagrees with itself, so another photo of the same card fails identically —
those say "type it instead". A single "scanarea a eșuat" would leave the operator
re-photographing a card that will never read.

**Two things it does not do, on purpose.** It fills, it does not commit — the
fields stay editable and scanning saves nothing. And it cannot restore
diacritics: MRZ text is transliterated, so `Ștefănescu` arrives as `Stefanescu`
and both panels say so next to the result rather than in a tooltip nobody opens.

**Deliberately not built:** live camera-stream scanning (a still photo is enough
and avoids a preview surface that holds the image), reading the card's printed
fields for diacritics, and NFC/eID chip reading.

**Tests: 72 new, plus 5 backend.** Web 437 (was 393 — 29 parser, 7 panel,
8 laziness/origin), mobile 111 (was 83 — 20 parser, 8 service). 15 golden cases cover both outcomes,
including the OCR-B confusion set being repaired by position, a card that
contradicts itself, and a truncated line that is **not** padded back to 30 —
padding line 2 would invent the composite check digit that exists to catch
exactly that.

**One thing this change did to CI, worth knowing.** Without an explicit
`manualChunks` entry, Rollup names tesseract.js's chunk after its entry module
and emits `index-<hash>.js` — which is the very pattern
`.github/scripts/bundle_budget.py` uses to find the **eager** entry chunk. The
budget silently counted a lazy 6.7 kB chunk against the initial download.
Naming the chunk `tesseract` moves it out of that pattern. A 444-byte interop
shim still lands on it; see TODO-47.

### TODO-14 `[DONE]` ID photos must not be readable by the developer
The stored ID photo must not be viewable by the developer/operator (i.e. by
whoever holds the DigitalOcean Spaces credentials).
*Open problem:* plain Spaces access means the bucket owner can read every
object. Needs a real design — likely client-side or app-layer encryption where
the key is not held alongside the data, plus a retention/deletion policy.
Treat this as a **prerequisite** for TODO-13 going anywhere near production:
CNP + ID photo is sensitive personal data (GDPR).

**Done, by removing the thing rather than protecting it: EcoTrack no longer
stores photographs of identity documents at all.**

**The item understated the exposure.** It asks about the person holding the
Spaces credentials. In fact `PhotoService.uploadPhoto` set
`ObjectCannedACL.PUBLIC_READ` on every upload, so each ID photo was on a
**working unauthenticated URL** — no credentials needed by anyone. The key was
`persoane fizice/{clientId}_{FullName}.jpg`, which is guessable and leaks the
client's name in the path. That URL was serialised as `idPhotoUrl` on every
client the app lists. And `GET /api/photos` enumerated the **entire bucket** for
any authenticated employee: while ID photos were stored, that was one call for a
list of every scanned identity card in the company.

**The design chosen, of three considered:**

| Option | Verdict |
|---|---|
| don't store the photo at all | **chosen** |
| store it encrypted client-side | rejected — see below |
| private ACL + presigned URLs, photo kept | rejected: closes the public leak, leaves the item's actual question unanswered |

Encryption was rejected on an honest reading of what it buys: AES-GCM in the
browser defends against bucket access, backups and DO staff, but **not** against
whoever deploys the app code, who can ship a build that leaks the key. It also
needs a key-custody answer nobody has ("who reads a photo a year from now?").
Once TODO-13 exists, the photo has no job left — it was only ever an input to
the two fields — so the strongest control is also the cheapest one, and it is
what GDPR data minimisation asks for anyway.

**Removed:** `PhotosController` entirely (`POST`/`DELETE /{clientId}/idPhoto` and
`GET /api/photos`); `PhotoService.getPhotos()`; `uploadIdPhoto`/`deleteIdPhoto`
on both clients plus `getAllPhotos` in mobile; `extractUrl` in
`web/src/api/live/normalize.ts`; `idPhotoUrl` from the web domain type, the
contract, the mock and the seed; the upload UI in the web drawer and mobile
`CreateClient`; the stored-photo viewer in mobile `EditClient`.

**Kept, for one release only: the `individual.id_photo_url` column.** Dropping it
in the same change that stops writing it would strand every already-uploaded
object permanently — personal data in a bucket with nothing left that knows it is
there. The order is forced: **purge first, drop the column second** (TODO-45).
The field is `@JsonIgnore`d so the URL never crosses the wire again, and
`ClientJsonSubTypesTest` asserts that, because removing the annotation would leak
silently rather than fail.

**New endpoint, temporary: `DELETE /api/admin/id-photos`** (with `GET` as its
preflight count). Deletes every stored object and clears the column — **only for
rows whose object actually went**, so a failed delete stays in the list and a
re-run retries it. Clearing regardless would report success while leaving the
object behind and destroying the last reference to it, which is the precise
outcome this exists to avoid. Not `@Transactional`: one transaction round the
loop would roll back every cleared column if the last row threw, while its
objects are already gone. No new `SecurityConfig` row (it inherits ADMIN from
`/api/admin/**`) and no `TaskAccessPolicy` call (neither task-shaped nor
employee-scoped) — `AuthorizationMatrixTest` pins it anyway, because its
protection is entirely inherited.

**This is an operator step, not a deploy step.** Deleting production data as a
side effect of somebody merging is not a thing that should happen. See
DEPLOYMENT.md, "Draining the legacy ID photos".

**Still public: task photos.** `uploadPhoto` is shared, and its `PUBLIC_READ` ACL
now affects only `task_photos/`. Filed as TODO-46 rather than fixed here —
making them private means presigned URLs in three screens, which is its own
change and not what this item asked for.

### Verification of TODO-13 + TODO-14 — uneven, and the backend half is the weak one

- **Web — fully verified.** Lint 0 errors, typecheck clean, build clean,
  bundle **139.9 / 160 kB** gzip (was 139.7 — the scanner is entirely lazy).
  436 of 437 tests pass; the one failure is `bootNavigation.test.tsx`, which
  **fails identically on a clean worktree at HEAD** and is filed as TODO-48.
- **Mobile — verified as far as it can be here.** Lint 0 errors, typecheck
  clean, 111/111 tests. **The native half has never run**: ML Kit needs an
  `eas build` and an Android/iOS device, neither of which exists on this
  machine. Everything below `TextRecognition.recognize` is proven; that call
  itself is not.
- **Backend — WRITTEN BUT NEVER COMPILED.** This machine has only a Java 8 JRE,
  so Gradle cannot load the Spring Boot plugin — the same wall TODO-20 hit.
  `cd backend && ./gradlew build` on JDK 21 is **owed**, and in particular it
  is what would catch a malformed `@Query` in `IndividualRepository`, which
  fails at context startup rather than at compile time.
- **Hygiene scripts — one of four run.** No Python here either (the `python3`
  on PATH is the Windows Store stub), so `doc_claims.py`'s two path checks were
  ported to Node and run: **all paths resolve**. `repo_hygiene.py`,
  `cross_project_invariants.py` and `dead_config.py` were **not** run.
- **Snyk was NOT run.** `.github/instructions/snyk_rules.instructions.md`
  requires a scan of new first-party code; no Snyk CLI or tool is available in
  this environment. Reviewed by hand instead — the JPQL is static and
  parameterless, the model download is HTTPS from a pinned tag with a SHA-256
  check, the MRZ regexes are linear, and no user string reaches `innerHTML`.
  **The scan is still owed.**

### TODO-45 `[ ]` Drop `individual.id_photo_url` once every environment is drained
TODO-14 stopped storing ID photos but deliberately kept the column, because it
is the only remaining record of the keys of objects already in Spaces. Dropping
it before deleting them would strand personal data in a bucket that nothing knows
about.

The sequence, in order:
1. On each environment, `GET /api/admin/id-photos` to see the count, then
   `DELETE /api/admin/id-photos` until it reports `remaining: 0`.
2. Then delete `Individual.idPhotoUrl`, `IndividualRepository`,
   `AdminIdPhotoController` and its test, and the matrix case
   `onlyAdmin_mayPurgeLegacyIdPhotos`.
3. Then drop the column by hand — `ddl-auto=update` never drops anything, so it
   will otherwise sit in H2 and in prod Postgres exactly like the orphaned
   `intake_message` / `order_draft` tables TODO-15 left behind.

*Blocked on:* a deployed environment existing to run step 1 against. The
appendix says there is no server yet, in which case there is nothing stored and
step 1 is a formality — but it must still be **confirmed**, not assumed, because
this is the step whose omission leaves personal data behind forever.

**Still open, deliberately — and the blocker is now one command instead of a
deploy.** Steps 2 and 3 were NOT done, because they are the irreversible half and
step 1 is still unconfirmed. What was done is to make step 1 answerable.

**The prefix is `persoane fizice/`, with the space.** Recovered from
`PhotosController.clientIdsFolderName` in `e55eb41~1`, before that class was
deleted — it was never written down anywhere that survives, and without it a
bucket check cannot tell ID photos from task photos. `DEPLOYMENT.md` now carries
an `aws s3 ls` recipe against the Spaces endpoint that needs **only the keys, not
a running server**, which is what actually unblocked this.

**What was checked here, and what it does and does not prove.** There is no
`backend/data/` H2 database in the working tree, no `backend/.env`, so this
machine has no Spaces credentials and no local rows. The deploy has never
succeeded (TODO-32: i/o timeout on SSH). **None of that is sufficient.** Commit
`2bc3614` shows `backend/data/damiprod.mv.db` was once committed and later
removed, and the old `146.190.224.202` droplet was live at some point — so builds
carrying the upload path did run somewhere. Whether they ran with Spaces
credentials configured is not knowable from this repository, and assuming they
did not is exactly the assumption this item exists to forbid.

**So the remaining work is one decision by whoever holds the Spaces keys:** run
the `aws s3 ls` above, note which bucket was checked, and either delete what it
lists or confirm it is empty. Steps 2 and 3 are then mechanical and safe.

### TODO-46 `[DONE]` Task photos are still uploaded with a public-read ACL
`PhotoService.uploadPhoto` sets `ObjectCannedACL.PUBLIC_READ`, so every object it
writes is on a working unauthenticated URL. Found while doing TODO-14, which
removed the ID photos from that path — what is left under it is
`task_photos/`: job-site photos a driver attaches when completing a task.

Lower stakes than an identity document, but the same shape of problem, and the
URLs are handed to clients as plain strings by
`GET /api/tasks/{id}/photos`.

Needs deciding:
- Private ACL plus short-lived presigned URLs, which means the three screens that
  render task photos (`CloudPhotoViewer` in mobile `Driver/TaskDetails`, and the
  web equivalents) stop being able to cache a URL and must ask for a fresh one.
- Or accept it, on the grounds that a cabin on a street is not personal data —
  in which case say so here, so the next person does not re-open it.

*Context:* the ID-photo exposure was the urgent half and is fixed. This is the
half that was deliberately left, so it is recorded rather than silently kept.

**Decided: private ACL plus presigned URLs — the first option.** The second
option ("a cabin on a street is not personal data") does not survive looking at
the actual object key, which this item did not have when it was written:

    poze cabine/{taskId}_{sanitizedClientName}/{n}

So a public URL **names the customer**, and its last segment is a counter
starting at 1 — anyone who obtains one link can walk that client's other photos
by changing one character. That is not "a cabin on a street"; it is an
enumerable, customer-labelled set of photographs of a customer's premises, on
permanent unauthenticated URLs. Recording the "accept it" reasoning as the item
invited would have meant recording something untrue.

**What changed.** `PhotoService.uploadPhoto` writes `ObjectCannedACL.PRIVATE`;
`presignedUrl` / `presignedUrls` sign a 1-hour GET through an `S3Presigner`
pointed at the Spaces endpoint; `GET /api/tasks/{id}/photos` and the POST's
`urls` both return signed links. The stored `task_photos.image_url` is unchanged
and stays the canonical identity — `extractObjectName` already turned a URL back
into a key, which is what made this a small change.

**The cost the item worried about did not materialise.** Neither client caches a
URL: web's `useTaskPhotos` sets no `staleTime` (so TanStack refetches on mount)
and mobile's `CloudPhotoViewer` holds them in component state until unmount. So
no screen needed changing — only their doc comments, which now say the URLs
expire, because that is now load-bearing rather than incidental.

**Two things a reader must not undo:**
- **The endpoint's guard is the whole authorisation.** A presigned URL needs no
  token, so `requireCanAccessTask` running first is what decides access; handing
  out a signed link anywhere without an equivalent check grants something nothing
  downstream can take back. Said so on both the method and the service.
- **A signing failure returns the unsigned URL, not an exception.** The caller
  gets a link that 403s instead of a blank gallery, and the ERROR line names the
  object. `TaskControllerTest` asserts the endpoint SIGNS rather than echoes —
  echoing is exactly what a regression to `PUBLIC_READ` would look like from
  outside.

**Still to do operationally, and it is not code:** objects uploaded by earlier
builds keep the public ACL they were created with. `DEPLOYMENT.md` has the
one-time `put-object-acl` loop over `poze cabine/`, and a warning to run it
*after* this release ships — doing it first would show drivers broken images
while the app still hands out raw URLs. Same shape as TODO-45's leftover, and
likely the same answer: per TODO-32 there may be no environment that ever
uploaded one.

**The owner's suggestion — a key on the device that decrypts the photo, applied
to the ID photos put in from the web — was considered and not taken, for two
different reasons depending on which photos it means.**

*For ID photos:* there is nothing to encrypt. TODO-14 removed storage entirely —
the card is OCR'd in the browser or on-device, `nume complet` and `CNP` are
extracted, and the image is discarded. `PhotosController` and both `idPhoto`
routes are gone. **Not uploading is strictly stronger than uploading encrypted:**
encryption still puts the ciphertext, its lifetime and its key management in our
hands, and a key that can decrypt is a key that can leak. The only thing left is
draining what old builds already wrote (TODO-45).

*For task photos:* a device-held key does not fit who has to see them. A driver
uploads a photo and office staff review it later, from other devices — so the key
would have to travel between devices, at which point it is a shared secret the
server distributes, and the server can decrypt too. That is the same trust model
as presigned URLs with more moving parts and a new way to lose photos forever if
a key is lost. Client-side encryption pays off when the server must NOT be able
to read the data; here the server is the thing deciding who may.

If end-to-end encryption is wanted anyway, the honest version is per-employee
keypairs with the object key wrapped per recipient, plus a recovery path for a
lost device — a real feature, not a tweak to this one. Open a new item for it
rather than reopening this.

---

## F. AI

*Deliberately near-empty. See TODO-17 before adding anything here.*

### TODO-15 `[DONE]` Delete the Mistral-based AI work
Remove what was built with Mistral (intake/extraction: `IntakeConfig`,
`service/intake/**`, `IntakeMessage`, `OrderDraft`, the
`ecotrack.intake.mistral.*` config).
*Intent:* AI in this app should eventually only **autofill** things — how
exactly is undecided.

**Done.** All 12 files deleted: `config/IntakeConfig.java`,
`service/intake/**` (7 files, including `MistralOrderDraftExtractor` and the
heuristic fallback), the `IntakeMessage` / `OrderDraft` entities and both
repositories. Nothing else referenced them — no controller, no test, no
property, and the `Clock` bean `IntakeConfig` declared had no other consumer —
so the removal is self-contained.

**Verified:** `cd backend && ./gradlew build` — BUILD SUCCESSFUL, 232 tests, 0
failures.

*Note:* `IntakeMessage` and `OrderDraft` were JPA entities, and
`ddl-auto=update` never drops anything, so their tables survive in H2 and in the
prod Postgres. They are orphaned, not gone; drop them by hand if the dead
columns bother you.

### TODO-16 `[DONE — one judgement call, see below]` Remove recommended additions to routes
The "recommended additions" suggestions on routes are not wanted. Remove them.

**Done.** The "Grupare sugerată pentru această rută" card is gone from the
dispatch board, and with it `suggestRouteGroup` and everything only it used
(`NEARBY_RADIUS_KM`, `densestSeed`, `localityOf`, the weekday filter) plus its
9 tests. `RoutesPage` no longer passes the unassigned pool to the panel; adding
work to a route is now a drag from "Neasignate" and nothing else. The
`useAssignTasksToRoute` mutation stays — the drag-and-drop multi-assign uses it
too.

**What was kept, and why you may want it gone as well:** the second card,
"Ordine mai scurtă a opririlor" (`suggestStopOrder`), still stands. It proposes
no *additions* — it re-sequences stops the dispatcher already put on the route —
so it read as outside "recommended additions to routes". **Say the word and it
goes too**; `grouping.ts` would then be left with `distanceKm`, which the map
feature imports.

### TODO-17 `[POSTPONED]` All other AI ideas
Deliberately deferred. Do not build AI features until the autofill use case is
decided. TODO-13 (ID scanning) is the one adjacent idea that may or may not end
up AI-backed.

---

## G. Repo & CI

*Workflows, guard scripts, deploy, secrets and the documentation they check.*

### TODO-18 `[DONE]` Fix the Dependabot config
`.github/dependabot.yml` is already grouped and monthly, but it still produced
13 PRs in one batch (#156–#168). Two separate problems:

1. **Majors are never grouped.** The `groups` only cover
   `update-types: [minor, patch]`, so every major bump opens its own PR by
   design. Add `ignore` entries with
   `update-types: [version-update:semver-major]` per ecosystem so majors stop
   opening PRs automatically and get upgraded deliberately instead — the same
   treatment Expo already gets.

2. **Scoped packages escape the mobile ignore list.** The rules are `expo`,
   `expo-*`, `react-native`, `react-native-*`, which do **not** match
   `@react-native-async-storage/async-storage` or
   `@react-native-community/datetimepicker`. Dependabot is therefore proposing
   exactly the Expo-SDK-pinned bumps that list exists to prevent (#166, #167),
   and `expo install` would undo them. Add `@react-native-async-storage/*` and
   `@react-native-community/*`.

**Done:** major-version updates are now ignored in all four ecosystems, and the
mobile ignore list gained `@react-native-async-storage/*`,
`@react-native-community/*` and `@expo/*`. Config validated.

*Note on the open PRs (user's call, not to be bulk-actioned):* the four grouped
batches are green and low risk (`web-minor-patch` #159, `mobile-minor-patch`
#163, `backend-minor-patch` #156, `actions` #162). The red ones are breaking
majors — Vite 6→8 (#164), Vitest 3→4 (#168, #161), async-storage 2→3 (#166).
**Spring Boot 3.5 → 4.1.1 (#158) is a whole major generation** and would touch
the security config, JPA setup and the enrollment code — close it.

### TODO-24 `[DONE]` Rotate the Google Maps key that is still in git history
A Maps key was committed in `807aec2`. The file that quoted it
(`HANDOFF-auth-security.md`) was deleted in `ada49c1` and its
`.github/repo-hygiene-allow.txt` entry has now been retired — **but deleting a
file does not rotate a key**. It remains reachable by anyone who can clone the
repo.

Rotate it in Google Cloud and restrict the replacement (referrer or package +
SHA-1, as `mobile/google-services.json`'s allowlist entry already demands for
the Firebase key). Only then remove the reminder comment left in
`repo-hygiene-allow.txt`. History rewriting is *not* required and is not
proposed here — rotation is what actually ends the exposure.

**Still open: the rotation itself is in Google Cloud and nobody in this repo can
do it.** What *could* be done here is done, and the history was checked first —
it is worse than this item said.

**Two different keys are involved. Fingerprinted rather than quoted** (sha256 of
the key string, first 10 hex chars) so they can be told apart in the Google Cloud
console without ever being written down again:

| Key | Where | Status |
|---|---|---|
| `sha256:5aa6a2ce91` | Maps/Places | **the leaked one — rotate it** |
| `sha256:8477701a13` | Firebase Android, `google-services.json` | ships in the APK by design; only needs its restrictions verified |

**`807aec2` is not where it leaked, and a handoff doc is not the only place it
sat.** `git log --all -S` finds the Maps key in four blobs across the history:

- `f548f87:frontend/app.json` — where it was **first committed**, in plain app
  config (`frontend/` is what `mobile/` was called then);
- `807aec2:frontend/.env` — "Added security for api key" moved it out of
  `app.json` into a `.env` **that was itself committed**, which is why the next
  commit is `13a7980` "env oopsies" deleting that file;
- `d1f7af5` and `a0e6441` — the `HANDOFF-auth-security.md` copies, deleted in
  `ada49c1`.

So three separate deletions have already been tried and the key is still one
`git show` away. That is the argument for rotating rather than tidying again.

**Rotating needs no code change.** Both consumers read the same environment
variable — `app.config.js` (`android.config.googleMaps.apiKey` and
`extra.googleMapsApiKey`) and, through `extra`,
`app/Sales/OrderTypes/OrderComponents/LocationPicker.tsx`. Set the new key in
`mobile/.env` for local runs and in the EAS secret for builds, then rebuild.

**Fixed here, because it would have broken the rotation:** `mobile/.env.example`
named the variable `GOOGLE_MAPS_API_KEY`, **without the `EXPO_PUBLIC_` prefix
that both consumers actually read**. Copying the template and pasting the new key
in would have produced a build whose `extra.googleMapsApiKey` is `''` and whose
every Places call answers `REQUEST_DENIED` — with the old key still live and the
new one looking broken. The template now carries both real names
(`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` and the missing `EXPO_PUBLIC_API_BASE_URL`,
whose absence leaves a build pointed at the dead `146.190.224.202` droplet) and
says what each is for.

**What remains, in order:** create a new Maps/Places key restricted to package
`com.damiprod.ecotrack` + the release signing SHA-1 → put it in `mobile/.env` and
the EAS secret → rebuild and confirm the picker still geocodes → **delete the old
key** (not merely restrict it: it is public, and an unrestricted-but-unused key
still bills) → verify `sha256:8477701a13` in `google-services.json` carries the
same package + SHA-1 restriction → only then remove the reminder block from
`.github/repo-hygiene-allow.txt` and close this item.

**Closed.** The owner reports the rotation is done in Google Cloud: the leaked
`sha256:5aa6a2ce91` key is deleted, its restricted replacement is in `mobile/.env`
and the EAS secret, and `sha256:8477701a13` in `google-services.json` is package +
SHA-1 restricted. The reminder block in `.github/repo-hygiene-allow.txt` is
removed accordingly, per that file's own rule. **The old key string is still in
git history and always will be** — that is now harmless because the key no longer
exists, and it is the reason no history rewrite was needed. The two
`google-services.json` allow-entries stay: that file is still committed by design.

### TODO-29 `[DONE]` Nothing validates the docker-compose files
Found while doing TODO-23: `repo-hygiene.yml` **fails any PR that touches
`docker-compose.yml`**, and always has — the file matches no `ci-*.yml` `paths:`
filter, which is exactly the "no workflow watches this" error that check exists
to raise. It went unnoticed because the file had not been edited since `bc47aec`.

Unblocked the cheap way, deliberately: `docker-compose.yml`,
`docker-compose.dev-hosted.yml`, `DEPLOYMENT.md` and `.env.example` were added
to `NO_CI_REQUIRED` in `.github/scripts/repo_hygiene.py`. For the two docs that
is simply correct — they are prose and a template of names, the same category as
`CLAUDE.md`/`README.md`/`TODO.md` already in that set.

**Update — partially covered now.** `repo-hygiene.yml` parses
`docker-compose*.yml` as YAML on every PR, so a syntax error is caught before
the VPS sees it. That is **not** the whole of this item: `docker compose config
-q` additionally resolves `${VAR}` interpolation and validates the schema, and
plain YAML parsing does neither. The `NO_CI_REQUIRED` comment says so, so the
exemption stays honest.

**For the compose files it is an exemption, not a verdict.** They are
load-bearing — `deploy.yml` watches `docker-compose.yml` and rebuilds the whole
stack from it — so a typo there is currently caught on the VPS, mid-deploy, and
nowhere earlier. The real fix is a small `ci-compose.yml` running
`docker compose config -q` on both files (pinned action SHA, or hygiene's own
unpinned-action check will flag it), and then removing the two exemptions again.

Needs deciding: is a validation-only workflow worth a fourth `ci-*.yml`, or
should the check be folded into `repo-hygiene.yml`, which already runs on every
PR and would need no new `paths:` filter?

**Decided: folded into `repo-hygiene.yml`, no fourth `ci-*.yml`.** A new
`ci-compose.yml` would need its own `paths:` filter, which is one more thing that
can drift out of step with the files it claims to watch — and the whole reason
compose was uncovered in the first place is a `paths:` filter that did not match
it. `repo-hygiene.yml` has no filter by design, so a compose file cannot escape
it however it is renamed. `docker` and the compose plugin are preinstalled on
`ubuntu-latest`, so this costs no setup step.

The old "Validate workflow and compose YAML" step is split in two: workflows are
still YAML-parsed, and compose files now get `docker compose -f <f> config -q`.

**It runs twice per file, and the two passes check different things:** once with
no env file, so every `${VAR}` takes its `:-default` — the way a developer runs
the stack from a clean checkout — and once with `--env-file .env.example`, which
pins that the committed template is actually sufficient. A newly added
`${VAR?required}` that nobody put in `.env.example` now fails in CI instead of
on the VPS.

**Verified against the real binary rather than assumed** (compose v5.2.0). Each
of these was injected into a copy of `docker-compose.yml` and confirmed to exit
non-zero, and none of them is a YAML syntax error, so the old step passed all of
them:

| Injected | Result |
|---|---|
| `containerr_name:` (unknown key) | `additional properties 'containerr_name' not allowed` |
| `depends_on:` a service that does not exist | `depends on undefined service` |
| `- caddy_dataa:/data` (undeclared volume) | `refers to undefined volume` |
| `networks: [ecotrack_networkk]` (undeclared) | `refers to undefined network` |
| `${VAR?must be set}` with no value | `required variable ... is missing a value` |

**And one it does NOT catch, stated in the workflow comment so nobody trusts it
too far:** `restart: unless-stoppped` passes cleanly — compose does not validate
that field's enum. This is a floor, not a proof.

`docker-compose.yml` and `docker-compose.dev-hosted.yml` **stay** in
`NO_CI_REQUIRED`: that set is about the `ci-*.yml` `paths:` requirement, and
these files are deliberately covered by the unfiltered workflow instead. The
comment there no longer says "covered, partially" — it now says what actually
runs.

### TODO-32 `[ ]` Deploy fails at the SSH step — the VPS is unreachable
Found on the push of TODO-22 (`a95825b`). **Not a test failure**, though it reads
like one: both gates (`verify-backend`, `verify-web`) went green — the `deploy`
job `needs:` them, so it only started because they passed — and then died on its
first action with

```
2026/08/30 13:47:11 dial tcp ***:22: i/o timeout
```

Nothing in the deploy script ran; the `======CMD======` block in the log is just
appleboy/ssh-action echoing the script before it connects.

**What the error narrows it to:** `SERVER_IP` is *set* (GitHub prints `***` only
for a secret that has a value), and an **i/o timeout** means the packets were
dropped rather than refused — no host, a powered-off host, or a firewall DROP. A
wrong-but-alive machine answers "connection refused" in milliseconds. So: the
droplet is gone or off, a cloud firewall/ufw is blocking inbound 22 from GitHub
runners, `SERVER_IP` is stale after a rebuild, or sshd is not on 22 (`deploy.yml`
sets no `port:`, so it defaults to 22).

This is consistent with the Appendix line that still says **"No users and no
server exist yet"**, and with the dead `146.190.224.202` droplet that survives as
a hardcoded fallback in `web/src/lib/config.ts` and `mobile/constants/ApiConfig.ts`.

**Why it needs a decision rather than a fix:** `deploy.yml` triggers on every
push to `main` touching `backend/**`, `web/**`, `docker-compose.yml` or
`Caddyfile`. While no server answers, **every such push turns main red**, which
trains everyone to ignore a red main — the expensive failure here, since the two
CI gates that DO mean something are in the same workflow run.

Options, none chosen:
- **Gate the deploy job** on a repo variable (`if: vars.DEPLOY_ENABLED == 'true'`)
  so the verify jobs still run and the deploy is skipped, not failed. Reversible,
  one line, and honest about the state.
- **Drop the `push:` trigger**, keeping `workflow_dispatch`, so deploying is a
  deliberate button press until a server exists.
- **Leave it red** on the argument that an unreachable production host SHOULD be
  loud. Defensible only once a server actually exists.

Decide after establishing whether a VPS is meant to exist right now. If one is
provisioned, this closes by fixing the host/firewall/secret and nothing in the
repo changes.

### TODO-40 `[DONE]` Three cross-cutting guard scripts
Cross-project facts that no toolchain checks, because the values are duplicated
across languages with no shared schema and nothing fails at build time when they
drift. All three run from `repo-hygiene.yml`, which has **no `paths:` filter** —
the whole point is comparing one project against another, so a filtered run
would miss exactly the PR that breaks the pair. Each step is `if: always()` so
one failure does not hide the others.

- **`cross_project_invariants.py`** — order-type names must match across
  `Order.java`, `web/types/domain.ts`, `mobile/types/OrderTypes.ts` and mobile's
  two untyped local copies; web `TASK_STATUSES` must match the backend enum
  except for a declared backend-only set (`CANCELLED`). Verified by temporarily
  adding a fourth order type: it named all four files that must follow. Absent
  mobile files are *skipped, not failed*, so TODO-33 can delete them.
- **`doc_claims.py`** — every backticked path in `CLAUDE.md` and the skills, and
  every path in a Java/TS comment, must resolve (understanding `@/` aliases,
  `./` relatives and `/.../` elisions). Pinned claims must match
  `application.properties`: **stating no number passes, stating a wrong one
  fails**, which suits CLAUDE.md's own "read them there rather than hardcoding a
  number" style. And named cross-references must still hold — `isOrderFulfilled`
  must keep naming `findLiveBySubscriptionId`, and the JPQL must keep naming
  `deriveLifecycle`, with the symbol checked and not merely the path. That last
  part exists because a path check is not enough: a pointer to a file that still
  exists but no longer defines the thing passes a path check and is still wrong.
- **`dead_config.py`** — `ecotrack.*` keys no Java source reads, reporting the
  env var's other homes so cleanup is one pass. It found TODO-23's Google
  plumbing independently. Bails out loudly if a `@ConfigurationProperties` class
  is ever added, since prefix binding would make key-by-key grepping report
  false deaths.

### TODO-41 `[DONE]` Re-establish a golden-fixture guard for the fulfilment rule
`isOrderFulfilled` (`web/src/features/sales/orderModel.ts`) and
`OrderRepository.findLiveBySubscriptionId` are one rule written twice, in two
languages, with no reference between them. TODO-40's `doc_claims.py` pins that
they keep *naming* each other; nothing checks that they still *agree*.

A shared golden-case file read by both suites was built for an earlier shape of
this pair and dropped when this branch merged, because that shape did not
survive: the backend rule now lives in **JPQL**, not in a policy class, so
driving it from a fixture needs a `@DataJpaTest` rather than a plain unit test.
That is the open question — whether the guard is worth a database-backed test,
or whether TODO-34 (making the two sides read the same roll-up) removes enough
of the risk that pinning the names is sufficient.

Cheap and worth doing either way: the web half of the rule is a pure function,
so a table of `(taskStatus → fulfilled)` cases costs nothing to assert.

**Done — and the open question is decided: the database-backed test IS worth it.**
Not because TODO-34 left much risk, but because of what writing it exposed:
`findLiveBySubscriptionId` had **never once been executed**. Its only coverage was
`SubscriptionServiceTest`, which stubs the repository — so the JPQL string
itself, the half no compiler checks, was verified by nothing at all. A
`@DataJpaTest` is the only way to reach it.

`shared/fulfilment-cases.json` holds ten cases of *(task statuses on an order) →
(summarised status, fulfilled)*. Both suites read that one file:

- `RepositoryTests/FulfilmentRuleTest.java` — a `@DataJpaTest` `@TestFactory`, one
  dynamic test per case. Each builds a plan, an order and its tasks, then asserts
  the roll-up, the JPQL, **and that the two agree with each other**.
- `web/src/features/sales/__tests__/fulfilment.test.ts` — the same cases through
  the mock's summariser and `isOrderFulfilled`.

Every task in a case is unscheduled on purpose, so no expected answer can come
from a date. `backendOnly: true` marks the two CANCELLED cases: that status exists
only in the backend enum (as `cross_project_invariants.py` declares), so the web
suite skips them and the backend runs all ten. Both suites assert the file is
non-empty first — a fixture that fails to load must fail, not pass vacuously.

**`shared/**` was added to the `paths:` of BOTH `ci-backend.yml` and
`ci-web.yml`.** Editing the fixture has to run both suites, which is the whole
point; it also keeps `repo-hygiene.yml` happy, since a path no `ci-*.yml` watches
is exactly what that check fails a PR for (TODO-29).

**Checked that it bites:** with `summariseOrderTasks` reverted to "first task
wins", three cases fail — the multi-task ones, and only those.

*This replaces `shared/order-lifecycle-cases.json`, which the reconciliation merge
dropped along with the `OrderFulfilmentPolicy` shape it was written for.*

### TODO-44 `[DONE]` `doc_claims.py` resolved paths with the OS separator
Found while verifying TODO-41: the script that checks every documented path
**failed 25 claims on Windows and none on Linux**, including obviously-present
files like `src/auth/RequireAuth.tsx`.

`repo_files()` built its index with `str(path.relative_to(ROOT))`, which is
`web\src\auth\...` on Windows, then compared it against tokens written with
forward slashes — so every path-shaped claim in the repo failed to resolve. CI is
Linux and stayed green, which is what let it sit: the script's own docstring says
it "runs locally exactly as it runs in CI", and on this developer's machine it did
not. Same shape as TODO-31's Windows-only test failures.

Fixed by indexing with `.as_posix()` — identical to `str()` on Linux, so CI
behaviour is unchanged — in all four places that built a path string. It now
reports **0 problems** on Windows, which is what made it usable for checking the
new claims in TODO-34 and TODO-41.

*Not fixed, because they are display-only and cause no false failures:*
`repo_hygiene.py`'s `check_action_pins` and `dead_config.py` still build an
annotation path with `str()`, so a local Windows run prints backslashed paths in
its messages. Both scripts pass.

### TODO-47 `[DONE]` `bundle_budget.py` counts lazy chunks named `index-*` as eager
The script identifies the eager entry chunk by the pattern `^index-[\w-]+\.js$`.
That assumes only the app entry is ever named `index-*`, and Rollup breaks the
assumption: a dependency reached only through a dynamic import gets a chunk named
after **its** entry module, and a package whose entry is an `index` file
therefore produces a second `index-<hash>.js` that the budget counts against the
initial download.

Found while adding tesseract.js in TODO-13, where it silently added 6.7 kB of a
lazily-fetched chunk to the reported initial download. Worked around there by
naming the chunk in `manualChunks` — but a 444-byte interop shim still lands on
the pattern, and the next lazily-imported dependency will hit it again.

The fix is to stop guessing from filenames: `dist/index.html` names the real
entry, and its static import graph is the eager set. That is a rewrite of
`main()` in the script, not a pattern tweak.

*Note:* it fails in the safe direction — it over-counts, so it can fail a build
that should pass, never pass one that should fail.

**Resolved — `main()` rewritten to derive the eager set instead of guessing it.**
`EAGER_CHUNK_PATTERNS` is deleted. The script now reads `dist/index.html`, takes
the `<script type="module">` it names as the entry root, and walks that file's
static `import` / `export … from` specifiers transitively; `import(...)` is a
code-split boundary and is not followed. `<link rel="modulepreload">` hrefs join
the root set, since the browser fetches those on first paint by definition.

Measured on the same build: **139.7 kB → 139.3 kB**, the difference being the
444-byte interop shim the item predicted. The stronger proof is with the
`manualChunks` workaround removed — tesseract's chunk is then emitted as
`index-<hash>.js` at 6.6 kB gzip, and the old script counted **145.9 kB** against
the budget where the new one reports **139.3 kB**.

The `tesseract: ['tesseract.js']` entry in `web/vite.config.ts` was **kept** —
its cache-boundary reason still holds, the same as `maplibre` — but its comment
was rewritten, because the budget-workaround half of it is now false and that
comment is exactly the kind of stale pointer `doc_claims.py` exists to catch.

*Correction to this item's own footnote:* the old approach did **not** only fail
in the safe direction. Over-counting was the visible half; the other half is that
only three name patterns counted as eager, so a genuinely eager chunk Rollup
named anything else — a shared chunk split out of the entry, for instance — was
silently filed as lazy and never budgeted. A synthetic `dist/` fixture reproduces
both halves at once: the old script charged for a lazy `index-*` chunk while
missing two real static dependencies of the entry. The graph walk has neither
failure.

Ambiguity still resolves toward failing: the specifier regex deliberately
over-matches (a false positive over-counts, which can only fail a build that
should pass), and a missing `index.html`, a missing `dist/assets`, or an
`index.html` with no module entry are all `::error::` + exit 1. The CLI contract
is unchanged — same argv, same `web/dist` default, same 0/1 exit codes, same
`GITHUB_STEP_SUMMARY` markdown table — so `ci-web.yml` needs no edit.

### TODO-48 `[ ]` `bootNavigation.test.tsx` fails on Node 24
`stays on /comenzi when a dead refresh token is stored` throws
`TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of
AbortSignal` from inside react-router's `createBrowserRouter`, under undici.

**Pre-existing, not caused by TODO-13/14** — verified by running the file from a
clean worktree at HEAD, where it fails identically. Recorded because it means
`npm run test:run` is not currently green on this machine, so "the suite passes"
has an asterisk on it and the next person will otherwise re-diagnose it.

The mismatch is jsdom's `AbortSignal` versus the one Node's built-in `fetch`
checks against — the same class of Windows/runtime-specific breakage as TODO-31
and TODO-44. Needs deciding whether to pin the Node version CI and developers
use, or to give this test a jsdom-compatible fetch.

**Bigger than one test, and worth knowing before the next person counts
failures.** Found again while doing TODO-57 (Node 24.20.0): the same error takes
down `src/routes/__tests__/screensSmoke.test.tsx` as well, all ten of its cases,
because it also boots the real router. So `npm run test:run` reports **11 failed
across 2 files**, not one — re-verified from a clean stash at HEAD on 2026-09-02,
where it fails identically. Every other web test file passes. The fix is the
same single decision; only the blast radius was understated.

### TODO-49 `[DONE]` CLAUDE.md's Known gaps still says mobile cannot authenticate
``Known gaps`` opens with "**The mobile app cannot authenticate.** It still posts
to the deleted `/api/auth/login` and has no enrollment screens (TODO-19)." The
same file's Auth section says the opposite three screens earlier — "**All three
projects can now get a session** (TODO-19)", naming `mobile/app/enrollment.tsx`
and `mobile/services/EnrollmentService.ts` — and TODO-19 is `[DONE]`.

Found while doing TODO-13/14. Not fixed there, because deleting a line from the
section that exists to say what is unsafe is a call for whoever knows why it was
left: TODO-19's entry may have shipped the screens without the bullet being
revisited, or the bullet may be pointing at something narrower that is still
true.

`doc_claims.py` cannot catch this — both paths it names resolve. It is a claim
about behaviour, and the file contradicts itself about it. **A wrong pointer is
worse than no pointer because it is followed confidently**, which is that
script's own docstring.

**Done — the bullet was simply false, in all three of its claims, and is
deleted.** Checked against the code rather than against the other paragraph:

| The bullet said | The code says |
|---|---|
| "has no enrollment screens" | `mobile/app/enrollment.tsx` (form → waiting → done) exists, with `mobile/services/EnrollmentService.ts`, `enrollmentStorage.ts` and `roleRouting.ts` beside it |
| "still posts to the deleted `/api/auth/login`" | `grep -rn "auth/login" mobile --include="*.ts" --include="*.tsx"` returns **three doc comments saying the endpoint was deleted** and nothing else. `mobile/app/login.tsx` does not exist; `AuthService` exports no `login` |
| "the mobile app cannot authenticate" | it enrolls: `EnrollmentService` calls `/enrollment/status`, `/request` and `/claim`, all three with `{ anonymous: true }` (`http.ts:98,112`), and `services/__tests__/EnrollmentService.test.ts` asserts that third argument on two of them |

So the Auth section's "**All three projects can now get a session**" is the
accurate half, and TODO-19's `[DONE]` is honest.

**Narrowing checked, not assumed.** The one part that could have survived is the
transport, so `mobile/constants/ApiConfig.ts` was read: it still falls back to
`http://146.190.224.202:8080/api` when `EXPO_PUBLIC_API_BASE_URL` is unset. That
is a real remaining gap — but Known gaps **already carries it as its own
bullet**, so it is not what this one was about and repeating it would not have
made the deleted claim true.

**Replaced rather than only deleted.** Dropping the bullet outright would have
left Known gaps with nothing about mobile, and there is a real one: TODO-35 —
mobile stores `user.roles` at claim time and never refetches, so a promotion or
demotion in Angajați never reaches the device. That is now the bullet in its
place. TODO-35 stays `[ ]`; this item only fixed the documentation.

### TODO-54 `[ ]` The live production build still ships the mock seed database
Found while measuring the bundle for TODO-47. `src/api/index.ts` does
`import { mockApi } from '@/mocks'` unconditionally and re-exports
`DEV_DEVICE_ID` from the same module, so `@/mocks` — and through it `seed.ts` —
is in the module graph of **every** build, not just mock ones. Verified: a
`VITE_DATA_MODE=live` build's entry chunk still contains the seeded employee
names (`grep -l "Radu Nistor" dist/assets/*.js` hits). `IS_MOCK ? mockApi :
liveApi` tree-shakes only about 2.2 kB gzip of it away.

It is small and it is not a secret — the seed is invented demo data in a public
repo — but it means the deployed app carries an in-memory database of fake
clients, orders and employees it can never use, and the growth is unbounded:
every row added to `seed.ts` for a nicer `npm run dev` lands in production.

Needs deciding: whether to split the two off (`DEV_DEVICE_ID` is a constant and
does not need to come from `@/mocks`; the `mockApi` import could go behind a
dynamic `import()` guarded by `IS_MOCK`), or to accept it and say so in a
comment, since the alternative loses the single synchronous `api` binding that
`src/api/index.ts` currently gives every feature.

### TODO-55 `[ ]` The bundle budget measures the mock build, not the deployed one
Same investigation. `ci-web.yml` runs `npm run build` with no `VITE_DATA_MODE`,
which `src/lib/config.ts` defaults to `'mock'` — so the number the budget gates
on is mock mode's. `web/Dockerfile` builds `VITE_DATA_MODE=live`, which is the
artefact users actually download. The two currently differ by 2.1 kB gzip
(139.3 vs 137.2), so nothing is wrong today and the gate errs high, which is the
safe side.

Recorded because the gap is not visible from either file and could silently
invert: a future mock-only dependency would inflate the gated number, and a
live-only one would escape it entirely. Cheapest fix is a `VITE_DATA_MODE=live`
on the CI build step so the gate measures the shipped bundle; that also makes
the number comparable to what the Dockerfile produces.

---

### TODO-50 `[ ]` Nothing checks that the index at the top of TODO.md is true
Found while reorganising this file (the pass that also closed TODO-49). The
*Index* and *Still open* lists near the top are now the only way to see the
backlog without reading 1900 lines — which makes them a new thing that can be
wrong. They are maintained by hand: *How to use this file* says adding an item
or changing its status is two edits, and nothing enforces the second one. An
index that has silently drifted is worse than no index, for the same reason
`doc_claims.py`'s docstring gives about a stale pointer: it is followed
confidently.

The check is cheap and mechanical, which is the argument for writing it rather
than trusting the rule. Parse every `### TODO-NN \`status\` title` heading, then
assert: every ID appears exactly once as a heading and exactly once as an index
row; the row's status and title match the heading verbatim; the row's section
letter matches the `## X.` heading the item actually sits under; the *Still
open* list is exactly the non-`[DONE]` set; and the *Next free ID* line is
highest + 1. That is roughly the script already used to verify this
reorganisation.

Needs deciding: a fourth guard script called from `repo-hygiene.yml` beside
`doc_claims.py` (which deliberately does **not** path-check TODO.md — this is a
different question about the same file, so it is a sibling, not an extension),
or a step folded into `repo_hygiene.py`. Either way it must run on every PR with
no `paths:` filter, since a stale index is exactly what a project-filtered run
would miss.

*Related:* TODO-40, which made the same argument for the three cross-cutting
guards that already run there.

**It had already drifted, in all three places at once, which settles the
argument.** Doing TODO-35/57 on 2026-09-02 found:

- the *Index* table ended at **TODO-57** — rows for TODO-58 through TODO-67 were
  never added, ten items;
- the *Still open* list ended at **TODO-63**, missing the four open items above
  it;
- **"Next free ID: TODO-64" was wrong** — TODO-64 through TODO-67 already
  existed, written by the UI and map passes. Trusting that line would have
  created a SECOND TODO-64, which is the one mistake this file cannot absorb,
  since an ID is a permanent name. It nearly did: the new item below was written
  as TODO-64 and renumbered to TODO-68 on discovering the clash.

All three repaired by hand in the same pass. Note what the drift was NOT: nobody
failed to write their item down. Every one of the ten is present, in its section,
with its full text. Only the three hand-maintained summaries were missed — which
is the argument for checking them mechanically rather than for trying harder.

### TODO-68 `[ ]` This machine cannot run the backend suite or the hygiene guards
Found while doing TODO-35/57, and recorded because it puts an asterisk on "the
tests pass" for every backend change made here.

**No JDK 17+.** `java -version` is 1.8.0_503 and it is the only JVM installed, so
`./gradlew` cannot even configure the project: *"Could not resolve
org.springframework.boot:spring-boot-gradle-plugin:3.5.7 … requires at least JVM
runtime version 17. This build uses a Java 8 JVM."* The `java { toolchain {
languageVersion = 21 } }` block in `build.gradle` does not help — a toolchain
decides which JDK COMPILES, after Gradle has already started on the one it was
launched with, and `settings.gradle` applies no foojay resolver, so nothing is
auto-provisioned either. No Docker to borrow a JDK from.

**No `python3`.** The path resolves to the Microsoft Store alias stub, which
prints an install prompt and exits non-zero. That is the interpreter for all four
checks the `verify` skill calls mandatory-on-every-PR — `repo_hygiene.py`,
`cross_project_invariants.py`, `doc_claims.py`, `dead_config.py` — plus
`bundle_budget.py`.

So of the documented verification, `web` and `mobile` (lint, typecheck, tests,
build) run here and **the backend suite and every hygiene guard do not**. Backend
changes are currently verified by review and by CI, which is where TODO-35/57's
Java changes were left.

Needs deciding, and it is one decision about the developer environment rather
than a code change: install a JDK 21 and a Python 3 on this machine (`winget` is
available), or add the foojay toolchain resolver to `settings.gradle` so Gradle
provisions its own JDK — that second one is a repo change and would still need a
Gradle-capable JVM to launch, so it only helps machines that have 17+ but not 21.
The Python half has no repo-side workaround short of rewriting five guard scripts
in Node.

---

## H. Mobile

*The Expo app: what it can do, and what it should stop doing.*

### TODO-19 `[DONE]` Mobile enrollment screens
Replace the mobile password login with the same flow the web now has: one
button + full name → six-digit code → waiting/polling → *"Sunteți înregistrat
cu rol de X"*. The backend contract is settled and tested; `mobile/` is still
untouched and still posts to the deleted `/api/auth/login`, so **the mobile app
cannot log in at all until this is done**.

**Done — the mobile app can authenticate again.** New `app/enrollment.tsx`
(form → waiting → done), `services/EnrollmentService.ts`,
`services/enrollmentStorage.ts`, `services/roleRouting.ts`. `app/login.tsx`,
`AuthService.login` and its `LoginResponse` type are deleted — the only callers
of the removed `POST /api/auth/login`.

**The trap worth remembering:** `BearerTokenAuthenticationFilter` rejects *any*
request carrying a token it cannot validate, and it runs BEFORE authorization —
so it fires on the `permitAll` enrollment endpoints too. A device whose session
was revoked still holds that dead token, so a plain `apiFetch` would have made
the one screen able to recover the device the one screen it cannot reach.
`apiFetch` gained `{ anonymous: true }`; all three enrollment calls use it and a
test asserts it. **No backend change was needed.**

`app/index.tsx` was an unconditional redirect to `/login` and had to become a
real boot gate — under enrollment, "go to the login screen on every launch"
means filing a fresh access request, needing a human admin, every time the app
restarts. Device id is minted once and persisted (`@ecotrack_device_id`,
single-flight); it is a self-asserted label, not a credential. Polling stops on
approval, rejection, expiry, countdown zero, *Anulează* and unmount.

Picked up on the way: the Sales and Technical menus' "logout" only changed
screens and never revoked the session — they now call `AuthService.logout()`.

Mobile: lint 0 errors, typecheck clean, **83 tests** (was 59).

**Unverified, and not claimed otherwise:** no end-to-end request→approve→claim
round trip against a running backend, and no render check on a device.

### TODO-33 `[ ]` Make the web app responsive, and move Sales + Technical out of mobile
Two halves of one decision: **the phone stops being a second full app and
becomes a browser**, except for the driver flow.

**1. Responsive web.** Every web screen must work on a phone-sized viewport.
Today the layouts assume width — the sidebar, the `DataTable` screens, the
drawers and the map — and there is no breakpoint story. Target a real
*web-mobile* experience: an off-canvas sidebar, tables that reflow into stacked
cards below `md` (note `DataTable` is `overflow-x-hidden` from TODO-04, so a
narrow screen currently *hides* columns rather than scrolling to them), drawers
that become full-screen sheets, touch-sized hit targets.

**2. Delete the Sales and Technical sections from `mobile/`** — `app/Sales/**`,
`app/Technical/**` and everything only they use. Mobile keeps **only the driver
experience**: my routes, my tasks, status changes, photo upload. Office staff
use the responsive web app on their phone.

**Why:** every order-type change currently has to be written twice (see the
`order-type` skill — the discriminator is duplicated with no shared source of
truth). One implementation is simpler, and the web one is more complete.

**Consequences to handle, not discover later:**
- `SecurityConfig`'s note that `PATCH /api/tasks/*/status` and
  `POST /api/tasks/*/photos` are "the only writes the driver app makes" becomes
  literally true — a checkable invariant rather than a comment.
- `mobile/types/OrderTypes.ts` and the order-type duplication mostly disappear.
  Update the `order-type` skill and `cross_project_invariants.py` when they do
  (the script already *skips* absent mobile files rather than failing).
- Do the responsive work **before** deleting the mobile screens, so office staff
  are never left without a usable phone surface.

### TODO-35 `[DONE]` Role changes on the web never reach the phone
The mobile app stores `user.roles` at claim time and never refetches. An admin
promoting or demoting someone in **Angajați** changes what the backend
authorizes but not what the phone renders: the device keeps showing the old
menus until it re-enrols. The mismatch is silent and lands on the user as
"button does nothing", or a 403.

Fix: refresh the stored user from `GET /api/auth/me` in the boot gate
(`app/index.tsx`), and probably after a 401-refresh too.

*Found while building TODO-19.*

**Corrected — this is smaller than the text above says, and it is NOT a
data-sharing problem.** Both apps do talk to the same backend and the same
database; nothing here disagrees about the data. What disagrees is one cached
copy of `user.roles`, written into device storage at claim time and used only to
decide which menu buttons to draw.

And the window is short, because a role change already forces the device out:
`AdminService.updateEmployee` calls `tokenService.revokeAllSessions(...,
"CREDENTIALS_CHANGED_BY_ADMIN")` whenever the role set actually changes, and
`mobile/services/http.ts` clears the tokens and fires its session-gone hook when
the refresh that follows the 401 fails. So the real sequence is: admin changes
the role → every session of that employee is revoked → the phone's next server
call 401s, cannot refresh, and lands on the enrollment screen → the device
re-enrols and stores fresh roles.

So the exposure is the gap between the role change and the phone's next request:
stale menus drawn from cache, and tapping one leads to a screen whose first API
call boots the user to enrollment. Confusing, not a privilege leak — the backend
authorizes from the `Employee` the token points at, never from the cached copy.

**Still worth doing** for the confusion, and because the guarantee currently
rests on "a role change always revokes sessions", which is a side effect of a
different feature and could be relaxed without anyone noticing this depended on
it. Deferred by the owner pending TODO-33, which may move Sales and Technical
out of mobile entirely and change what the cached roles are even for.

**Done — and it stays worth having even if TODO-33 deletes the Sales and
Technical screens**, because the boot gate routes on those roles no matter how
many screens are left to route to.

`AuthService.syncCurrentUser()` re-reads the employee from `GET /api/auth/me`
and rewrites the cached copy, reporting whether the ROLE SET changed. Two callers:

- **`app/index.tsx`, the boot gate** — routes on the fresh answer, so a restart
  is enough to pick up a role change.
- **`setOnSessionRenewed` in `services/http.ts`** — a new hook fired after each
  successful silent refresh, wired in `app/_layout.tsx`. On a real role change it
  alerts and sends the device back through the gate; on no change it does
  nothing, because re-routing every 30 minutes would throw away whatever screen
  the user was on for nothing. This is the half that survives the guarantee being
  relaxed: it does not depend on a role change revoking sessions.

**A failed call keeps the cached roles** and returns null. A phone with no signal
still holds a valid refresh token, and treating one lost packet as "signed out"
would be a worse bug than the one being fixed. A token that is genuinely dead
still takes the existing path: the 401-refresh fails, `onSessionExpired` fires,
the device lands on enrollment.

**One thing had to move for this to work at all.** `apiFetch` returned early on a
401 from anything under `/auth/**` — "these credentials are wrong, the caller
renders it". That is true of `/auth/refresh` and `/auth/logout`, which
authenticate with the refresh token, and false of `GET /auth/me`, which is an
ordinary bearer read. At launch the stored access token is nearly always past its
30-minute life, so under the blanket rule the boot-gate sync 401'd and gave up
**every single time** — the fix would have shipped looking correct and doing
nothing. The check now names the two endpoints instead of the prefix, and
`services/__tests__/http.test.ts` pins it.

Also deduplicated on the way through: the user normaliser existed twice, in
`EnrollmentService` and (about to be) in `AuthService`. It now lives once in
`services/userModel.ts` with `rolesEqual`, both dependency-free so the node
Vitest project runs them with no mocking. Two normalisers would have let the
roles stored at claim time and the roles stored on a refresh differ in case
alone, which `roleRouting` reads as different roles.

Covered by `services/__tests__/AuthService.test.ts` (rewrites the copy, uppercases,
no false "changed" on reordered roles, keeps the cache on failure) and
`services/__tests__/http.test.ts` (which 401s retry, and that `/auth/me` does not
re-trigger its own hook). The residual gap — a phone idle on a menu still shows
the old one until its next request — is recorded in CLAUDE.md's *Known gaps*.

---

## I. Found while doing something else

*This section used to hold TODO-22 through TODO-49 — 28 items of every topic, in
the order they were noticed. They are now filed under the section each belongs to
(A–H, J); the index above says where each one went. The original preamble is kept
here because it is still true of those items:*

> *Each of these was noticed during other work (the TODO-15/16/21 pass and the
> refactoring that followed) and deliberately not fixed there: none is a
> behaviour-preserving cleanup, and each wants a decision of its own.*

**Nothing new gets filed here.** "Found while doing something else" is where an
item came from, not what it is about, and filing by provenance is what made this
file unreadable. A loose end noticed while doing something else still gets
written down — the standing rule is unchanged — it just goes into the section
whose code it concerns, at the next free ID. Say in the item's own text what you
were doing when you found it, the way TODO-42 and TODO-46 do.

---

## J. Code health & platform

*Backlogs and infrastructure that belong to no one screen.*

### TODO-25 `[DONE]` Backend logging: `System.out`/`System.err`, and a swallowed failure
`DataLoader`, `RecurringTaskScheduler` and `PhotoService.deletePhoto` print to
stdout/stderr while the rest of the backend uses slf4j — so those lines miss the
log format, the levels and anything that ships logs off the VPS.

`PhotoService.deletePhoto` is the one with teeth: it **swallows a delete failure
to stderr**, so a photo that fails to delete leaves no trace anywhere anyone
looks. Decide whether it should propagate, and at what level, before mechanically
swapping the print for a logger call — the logger swap alone would tidy the
symptom and keep the bug.

**Done. The decision on `deletePhoto`: do NOT propagate — report.** Every caller
that currently ignores the result is a cascade whose actual job is deleting a row
(a client, or a client's orders and their task photos), and they delete objects
*before* the rows. Throwing would abort such a cascade halfway, with some objects
already gone and the client still there — a state the operator has no way to
finish or retry cleanly. A row deleted with its object left behind is
recoverable; a half-deleted client is not. The method already returned a
`boolean`, so the contract was right; what was broken was that nothing usable was
recorded.

So the failure is now an **ERROR carrying the bucket, the object key and the
exception** — the old line had none of them, only `e.getMessage()` on stderr.
That matters because once the owning row is gone the key exists nowhere else:
this log line is the only remaining way to find what was orphaned.

**And the callers now say whose photo it was**, which the service cannot know:
`ClientService` logs a WARN naming the task and client for an orphaned task
photo, and an **ERROR** for an orphaned ID photo — personal data, deleted
immediately afterwards along with the only row linking it to a person (TODO-14).

The rest was the mechanical half:

- `DataLoader` → slf4j. "Checking for seed data" is DEBUG (it says nothing when
  nothing happens); the two seeding lines and the product count are INFO, because
  they record a database that was actually written to.
- `RecurringTaskScheduler` → slf4j. The per-plan failure is `log.error(msg, e)`
  **with the exception**, not its message: one plan failing does not stop the
  fleet (a test pins that), so this line is the only evidence it happened, at
  02:00 with nobody watching. The closing line now reports `generated` out of
  `activePlans.size()` rather than just the one number.
- **`DamiProdApplication`'s `CommandLineRunner` is deleted, not converted.** Its
  whole body was `System.out.println("Server started successfully")`; Boot
  already logs `Started DamiProdApplication in Xs` through the same appender,
  with a timing the print did not have. A comment in its place says so.

`grep -rn "System.out|System.err" backend/src/main` is now empty. **Verified:
`./gradlew test` — 253 tests, 0 failures.**

*Left open deliberately:* nothing reaps the objects these ERROR lines name. The
log makes an orphan findable by a human reading logs; it does not clean it up,
and for ID photos "findable in a log" is not a retention policy. That belongs
with TODO-14, which has to decide how long ID photos may exist at all.

### TODO-26 `[DONE]` The web react-hooks lint backlog
`npm run lint` is 0 errors / 105 warnings. Two clusters are real and deliberately
deferred:
- **`react-hooks/set-state-in-effect` (~25 sites)** — a derive-state-from-props
  pattern spread across most of the feature layer. Clearing it is a repo-wide
  refactor, not a cleanup, and each site needs its own reading.
- **`react-hooks/refs` in `components/ui/utils.ts`** (`useEscapeKey`,
  `useOutsideClick`, `useEvent`) — the same idiom that was fixed in
  `lib/hotkeys.tsx`, but `useEvent`'s returned callback can legitimately run
  before passive effects flush, so moving its ref write is a semantic change.
  These hooks sit under every modal in the app.

The 25 messages from `useStableBounds` in `MapPage.tsx` are **not** in scope: its
comment argues that a render-time ref write is the correct idiom there, and it is.

**Done. `npm run lint`: 105 warnings → 48, and `react-hooks` is 61 → 3.** Every
one of the 25 `set-state-in-effect` sites was read on its own, because they were
not one pattern — they were five, with five different right answers. What follows
is the taxonomy, since the next person to add a screen will write one of these
again:

**1. The highlight clamp — a real bug, not a style violation (5 sites).**
`Autocomplete`, `Select`, `CommandPalette`, `useListKeyboard` and `ClientPicker`
all stored a highlighted index and corrected it in an effect when the list
shrank. An effect corrects it **one render too late**, and that render is real:
`items[highlight]` is `undefined`, so the listbox draws a highlight on nothing,
`aria-activedescendant` points at a row that is not there, and **Enter commits
nothing**. Now clamped on read — `Math.max(0, Math.min(stored, length - 1))` —
which is not a workaround but the honest statement that the index only means
anything relative to the current list. The arrow-key handlers step from the
clamped value too, or they wrap from an index that no longer exists.

**2. Nine deep links, one hook.** Every screen that accepts an intent
(`?comanda=`, `?client=`, `?ruta=`, `?sarcina=`, `?zi=`, `?plan=`, `?nou=`)
carried its own six-line copy of "if the param is there, apply it, then clear
it". They are now `useDeepLinkOnce` / `useDeepLinkFlagOnce` in `lib/deepLink.ts`.

**This one keeps its effect, and that is the considered answer, written down
once instead of nine times.** A URL is an external store owned by the router, not
a prop to derive from, so there is nothing to compute during render; and there is
no handler to move it into, because the navigation happened in the command
palette, in another tab, or in a link someone pasted — *the arrival is the
event*. The refactor that would genuinely delete the effect is to stop copying
the intent into state and let the URL **be** the open drawer. That is a real
design and a bigger one — it changes what Back does on every screen — so it is
not something to smuggle in under a lint fix. Recorded here rather than done.

**3. Reset-on-open → remount (5 sites).** `RouteFormModal`, `AssignRecurringModal`,
both pickers and `CommandPalette` kept a stale filter/draft while closed and
cleared it in an effect. `Modal` already returns `null` when closed, so nothing
of them was on screen anyway: each is now a two-line wrapper that returns `null`
and a body that only mounts while open. State resets because it never survives —
which also cannot be forgotten when someone adds a sixth `useState` later.

**4. Two moved to the event that causes them.** `Select` put the cursor on the
current value in an effect keyed on `open` (with an `exhaustive-deps`
suppression to hide that it read `visible` and `value` too); it now happens in
the two handlers that open the list, so the first painted frame is already
right. `CommandPalette` reset its highlight in an effect on `query`; it now
happens in the input's `onChange`.

**5. Two derived instead of stored.** `RoutesPage`'s selected route is computed
from the filtered list (stored id if still visible, else the first row) — the
effect version left one render where the selection pointed at a route that had
just been filtered out, long enough for `useRouteTasks` to fetch its tasks.
`OrdersPage`'s Curente/Arhivă follow is now React's documented *adjust during
render* pattern, keyed on the order **and** its archived-ness, because the task
status arrives from a later query and that late answer has to move the tab too.

**The one that stays, with a reason in the code:** `EnrollmentPage`'s poll.
Nothing to derive (the answer is on a server), no event to move it into (waiting
for an admin *is* the screen), and the first immediate tick is the point.

**The `react-hooks/refs` cluster:** `useEscapeKey` and `useOutsideClick` now
write their handler refs in an effect — safe precisely because each ref is only
read from a listener that a later effect installs, so it cannot be read before
the commit. **`useEvent` keeps its render-time write**, as this item predicted:
its returned callback can run before passive effects flush and would then call
the previous render's function, which is a behaviour change under every modal in
the app. It carries a one-line suppression and the paragraph explaining it.
`useStableBounds` in `MapPage.tsx` keeps its 26 warnings' worth of idiom, but the
disable is now **scoped to that function** rather than left as noise — the rest
of the file still reports, so the next real one is visible.

**What is left, and why:** 3 `react-hooks` warnings, all in `AuthProvider.tsx`
(one `exhaustive-deps` that already carried a suppression for the
`scheduleRefresh`/`runRefresh` mutual recursion, plus `immutability` and
`preserve-manual-memoization` on the same block) and 45
`react-refresh/only-export-components`, which is a Fast-Refresh advisory about
files exporting both a component and a constant — a different rule, a different
question, and untouched here.

**Verified:** typecheck clean, **395 tests green**, build clean, bundle
**139.6 kB / 160 kB**.

### TODO-31 `[ ]` The backend test suite shares one database across classes
Found while doing TODO-22: **the backend suite was not reliably green before
this change**, and the reason is test isolation, not product code.

Two distinct problems, one fixed and one only worked around:

**1. Clock-granularity races — FIXED.** Three `TokenServiceTest` cases built a
`TokenService` with 0-day retention, making the prune cutoff `Instant.now()`,
then compared it against timestamps stamped microseconds earlier with a STRICT
`<`. Two `Instant.now()` calls can return the same value — the clock is coarser
than the code is fast, ~15 ms on Windows against ~µs on Linux — so `revokedAt <
cutoff` was false and nothing was pruned. The LRU cap test had the same tie
problem in `ORDER BY lastUsedAt`. All three now stamp an explicit age
(`backdateRevokedAt` / `backdateLastUsedAt`) instead of racing the clock. This
is why the suite passed on CI (Linux) and failed on the developer's Windows
machine — a class of failure that will keep recurring while tests use
`Instant.now()` as both the data and the cutoff.

**2. Cross-class committed state — NOT fixed, only accommodated.**
`EnrollmentFlowTest`, `EnrollmentBootstrapCodeTest` and `AuthEnforcementOffTest`
are deliberately not `@Transactional` — they exercise the first-user bootstrap,
which needs committed state — and each leaves a committed ADMIN employee behind
in the shared in-memory database. Any later test that asserts something about
the WHOLE table therefore reads other classes' leftovers.
`LastAdminGuardTest` works around it by demoting every pre-existing admin in its
own `@BeforeEach` (rolled back, so it leaks nothing), and asserts its
precondition so a future drift fails loudly instead of looking like a guard bug.

That workaround is per-test and does not generalise. Needs deciding: give the
non-transactional classes `@DirtiesContext` (slow — a fresh context each time),
have them clean up after themselves explicitly, or move bootstrap tests onto
their own isolated datasource. Until then, **any new assertion about a global
count is unsafe by default.**

### TODO-51 `[ ]` The web app throws away the server's Romanian refusal text
Found while doing TODO-39, which adds a third backend 409 whose whole value is
its message.

`errorMessage()` in `web/src/features/technical/utils.ts` maps any `ApiError`
that is not 404 or 5xx to `"Cererea a eșuat (cod ${status})."` — it never reads
`ApiError.body`, which is where the backend's user-facing Romanian text arrives.
So the operator is told "the request failed (code 409)" instead of *why*, for at
least three refusals that were each written to be readable:

- `InsufficientQuantityException` — "Cantitate insuficientă la locație.
  Disponibil: N, solicitat: M." (`live/orders.ts` documents it as reachable via
  `ApiError.body`)
- the retired-plan refusal added by TODO-39 — "Abonamentul „X" a fost dezactivat…"
- `SubscriptionService.blockedMessage`, which goes to the trouble of agreeing in
  Romanian ("1 comandă" vs "24 de comenzi") — and is only ever seen because
  `SubscriptionsPage` special-cases 409 **on that one screen**.

That per-screen special case is the tell: the fix belongs in `errorMessage`, not
in a fourth copy of it. Needs deciding: surface `ApiError.body` verbatim whenever
it is non-empty and plain text (simple, but the backend sometimes returns a JSON
error envelope — `GlobalExceptionHandler.body()` builds `{status, error,
message}`, so it would have to prefer `.message` and fall back to the raw text),
or add an explicit allowlist of statuses whose body is known to be user-facing.
Mobile has the same gap in its `Eșec la …` throw sites and should follow whichever
is picked.

### TODO-58 `[ ]` The UI rebuild stopped short on four surfaces
The web UI was rebuilt on shadcn/ui + Mantine (see `.claude/skills/web-ui-shadcn`
and `web-ui-mantine`): one token system with real dark mode, an Outlook-style
shell (navy top bar, collapsible nav pane, `CommandBar` ribbon, `ListDetail`
reading pane), and every screen moved onto it. Four things were planned and are
NOT done, because the agents doing them ran out of budget mid-file:

- **`OrderFormDrawer`** (957 lines) still lays its fields out by hand rather than
  with shadcn's `Field`/`FieldGroup` composition, and has no unsaved-changes
  guard on close. It works and it is on the new controls; it is the one form in
  the app that does not read as sectioned.
- **The map chrome** (`MapControls`, `MapLegend`, `HoverCard`) got the token
  sweep but not the redesign — floating `ButtonGroup` clusters, a legend that
  collapses to a button on mobile. Do not touch the container's inline
  `position:absolute; inset:0` (see CLAUDE.md).

  *Update — the screen around it is done, the floating chrome is not.* `MapPage`
  was the last screen still framed by `PageHeader` + a bare fragment; it is now
  `Workbench` + `CommandBar` like every other screen, its two layer switches are
  one `ToggleGroup` (pressed state instead of two buttons flipping variant), and
  the filter rail is a real pane with a `PaneHeader` and its own scroll
  container, hidden below `md`. The token sweep had in fact **missed**
  `MapCanvas` and `MapLegend`: both floated `bg-white/95` cards, which is a
  white sheet over a dark map in dark mode. Fixed to `bg-surface/95`. What is
  still open here is only the redesign this bullet describes.
- **`IdScanField`** has the three states but not the dragged-file/camera polish
  the rebuild brief described.
- **`ClientFormDrawer`** is in the same position as `OrderFormDrawer`.

None of these is broken — they are the parts that are merely *fine*. Deciding
needs nothing; it is work, not a question.

### TODO-59 `[ ]` The eager bundle grew from ~125 kB to ~260 kB gzip
Two component libraries have a floor. `MantineProvider` wraps the app (~37 kB
gzip), the Radix primitives behind the shell's dialogs, menus, tooltips and
sheets are on the first-paint path (~37 kB), and the shell is bigger than the
sidebar it replaced. `BUDGET_GZIP_KB` in `.github/scripts/bundle_budget.py` was
raised 160 → 280 deliberately, with the reasoning in a comment there.

What was already done: the command palette and the shortcut overlay were pushed
out of the eager graph (they pulled cmdk, the whole UI-kit barrel and both
feature modules' query hooks to render something invisible until ⌘K), and
`GLOBAL_GROUP` moved into `lib/hotkeys` so importing it no longer drags the kit
into the shell.

What is left to try, in order of expected yield: **split the `@/components/ui`
barrel** so a screen importing `Button` stops pulling `DateInput` and through it
`@mantine/dates`; check whether the `radix-ui` umbrella package tree-shakes as
well as the individual `@radix-ui/react-*` packages would; and confirm whether
the mock seed is really being dropped from the `VITE_DATA_MODE=live` build
(measured 155 kB vs 153 kB, which is suspiciously little — see TODO-54).

### TODO-60 `[ ]` Mantine's full stylesheet ships for four components
`src/index.css` imports `@mantine/core/styles.css` (plus dates, notifications,
spotlight, charts) into `@layer mantine`. That is ~500 kB raw / ~73 kB gzip of
CSS for what the app actually uses out of Mantine: the date field, the combobox
internals, and the notification host. Mantine supports per-component imports
(`@mantine/core/styles/Input.css`, …), which would cut most of it.

Not done because the safe list is not obvious — a missed import is an unstyled
control in a corner of one screen, and there is no test that would catch it.
Deciding it needs someone to walk the Mantine components actually rendered and
write the list, ideally with a lint rule or a comment pinning it next to the
imports. Keep the `layer(mantine)` wrapper on whatever replaces it: that layer
order is what lets a Tailwind utility beat a Mantine style without `!important`.

### TODO-61 `[ ]` The legacy `brand-*` ramp has no dark values
`--brand-50 … --brand-900` are declared once, on `:root`, and NOT redefined
under `.dark` — unlike every other token in `src/index.css`. Nothing in
`src/features` uses them any more (they were swept to `accent-*` / `primary` /
`surface-*` during the rebuild), and the rail deliberately stays navy in both
themes, so this is latent rather than live.

It is a trap for the next person: `bg-brand-50` still compiles, still looks
right in light mode, and is a white slab in dark mode. Either give the ramp dark
values, or delete the tokens and let the class stop compiling. The second is
better and is a five-line change; it is listed here rather than done because
deleting a token is the kind of thing that should be one commit with a reason.

### TODO-62 `[ ]` `PageHeader` and `CommandBar` are two components for one job
The kit's `PageHeader` (title / subtitle / actions) and the layout module's
`CommandBar` (the same, plus `tools`, `tabs` and an overflow menu) now render
the same strip, and they are styled to match by hand rather than by sharing an
implementation. Every screen uses `CommandBar`; `PageHeader` survives for the
frozen contract in `components/ui/types.ts` and for callers that only need a
title row.

They will drift — that is what two implementations of one strip do. The fix is
to make `PageHeader` a thin wrapper over `CommandBar`, which is easy; what needs
deciding first is whether `PageHeader` should stay in the frozen contract at all
now that nothing but the kit itself renders one.

*Update: "every screen uses `CommandBar`" is now literally true.* `MapPage` was
the last caller of `PageHeader` and moved to `CommandBar` with the rest of the
map work in TODO-58, so `PageHeader` is exported by the kit and rendered by
nobody. Deliberately left in place rather than deleted: `PageHeaderProps` lives
in `components/ui/types.ts`, which is the frozen contract, and removing an
export from it is exactly the decision this item exists to make. It is a smaller
question now — the answer is "delete it or make it a wrapper", with no caller to
migrate either way.

### TODO-63 `[ ]` The dispatch board is still drag-and-drop only
`RoutesPage` moves a task onto a route by dragging (`@dnd-kit`), and below `lg`
its three columns are now tabs — which means the drag source and the drop target
are frequently not on screen at the same time. There is a "Mută" button per
route stop that opens a route picker, but the **unassigned queue has no
equivalent**: a task in "Neasignate" can only be dragged.

So on a phone, and for anyone driving the board from the keyboard, half the
board's central action is unreachable. The fix is a per-task menu in the queue
with "Trimite pe ruta…", reusing `RoutePickerModal`, which the stops column
already does. Not done in the rebuild because the board's drag wiring was left
untouched on purpose and this adds a second write path through it.

### TODO-64 `[ ]` Two `/comenzi` tests time out under the full web suite
Found while doing the map work, and **not caused by it** — verified by stashing
the change and re-running: the same two fail either way, and both pass when
their files are run alone.

`screensSmoke > renders '/comenzi'` and `bootNavigation > stays on /comenzi`
hit vitest's 5000 ms default. Comenzi is the heaviest screen to boot — the whole
shell, the orders list, and then `useOrderTaskStatuses` fanning out **one
request per order** (TODO-43) — so under a fully parallel suite on a loaded
machine it is the one that crosses the line. On a quiet machine the same suite
is green, which is why this has not been seen in CI.

That makes it the same shape as TODO-31 on the backend: a test that passes or
fails on how busy the machine is teaches everyone to re-run rather than read.

Needs deciding, and they are not equivalent: raise `testTimeout` for these two
(honest, hides nothing, but a slower boot then goes unnoticed); or make the
smoke test mount `/comenzi` with a smaller seeded dataset; or fix TODO-43, which
removes the fan-out that makes this screen slow in the first place and is the
only option that makes the app faster rather than the test looser.

### TODO-69 `[DONE]` Three bugs only a live backend could show
The web had never actually been run against the Spring backend — mock mode is
the default and every test uses it. Booting both and driving the real UI found
three things at once, none of which any test could have caught.

**1. Every date field in a drawer was dead.** Clicking a day in the calendar did
nothing: the field stayed empty and the order form answered "Selectați perioada
de amplasare", so **an order could not be created at all**. Typing a date worked,
which is what made it look like a mystery instead of a broken control.

The kit's Drawer/Modal are Radix `Sheet`/`Dialog` in modal mode, and Radix
enforces modality by setting `pointer-events: none` on `<body>` while one is
open — only its own subtree stays interactive. `DateInput` passed
`popoverProps={{ withinPortal: true }}`, mounting the calendar on `<body>`,
OUTSIDE that subtree, so every day cell inherited `pointer-events: none`. The
click fell through to the backdrop, which dismissed the popover. Confirmed in the
browser before fixing: `getComputedStyle(body).pointerEvents === 'none'` and the
same on the day cell. Now `withinPortal: false`, so the calendar renders inside
the dialog that owns it.

*Note for whoever adds the next Mantine dropdown inside a dialog* — Combobox,
MultiSelect, Spotlight all have the same prop and the same trap.

**2. Every order created through the app was `#0`.** `Order.number` is a
primitive `long` and **nothing ever assigned it** — there is a constructor that
takes one and no caller anywhere. Mock mode invents numbers in its seed, so the
Comenzi table looked right in every screenshot ever taken of it. It also made
`findLiveBySubscriptionId`'s `ORDER BY o.number ASC` an ordering over a column of
zeroes. `OrderService.createOrder` now assigns `number = id` after save: unique
by construction, no `MAX(number)+1` read for two concurrent creates to race
(TODO-39's shape), and the entity is managed inside the existing `@Transactional`
so it flushes without a second `save()`. A caller-supplied number still wins.

**3. Every date popup was in English.** "September 2026", "Mo Tu We Th Fr Sa Su",
inside an app that is Romanian everywhere else. `DateInput` calls
`dayjs.locale('ro')`, but that sets the GLOBAL dayjs locale and Mantine reads
from `DatesProvider`, which was not mounted. Added to `AppProviders` with
`locale: 'ro'`, `firstDayOfWeek: 1` and a Sat/Sun weekend, so a new date field
cannot forget them.

**Verified end to end against a real server:** fresh H2, first-run setup code
from the log, enrolment through the UI, then products, clients, routes,
employees, tasks and recurring plans all reading 200 with no CORS or normalise
errors; a client created; an order created and rendered as **#33** with the date
picked from the calendar. Backend **302 tests**; web typecheck, lint, build and
**458 tests** green (the one failure is TODO-64's known `/comenzi` timeout).

### TODO-70 `[ ]` Orders created before the numbering fix are still `#0`
TODO-69 numbers orders from now on. It does not touch rows that already exist,
so any database written before it has orders whose `number` is 0 — they all
render as "#0" on Comenzi and sort arbitrarily under
`findLiveBySubscriptionId`'s `ORDER BY o.number`.

Nobody is running this in production yet, so the cheap answer is to drop the dev
H2 file and start clean, and that is what makes this a `[ ]` rather than work
already done. If any database is worth keeping by the time this is read, it
needs a one-off `UPDATE orders SET number = id WHERE number = 0` — and there is
no migration tool in this repo (`ddl-auto=update`, see *Known gaps*), so decide
where such a statement is supposed to live before writing it.

### TODO-66 `[ ]` The map tiles stay light in dark mode
Found during a browser pass over every screen in both themes. `MAP_STYLE_URL`
points at one OpenFreeMap style, so in dark mode a bright white-and-green map
sits inside an otherwise dark app, framed by dark chrome. The overlays on top of
it are correct now — the legend and hover card were `bg-white/95` and were swept
to `bg-surface/95` — which is what makes the mismatch obvious: a dark card on a
light map.

Not fixed here because it is a product choice, not a bug in the code: it needs a
second style URL (OpenFreeMap publishes dark variants), a decision about whether
the map follows the app theme or stays light on purpose — a light basemap is
easier to read outdoors and the pin colours were picked against it — and a
re-check of every pin, route line and heatmap ramp against the darker ground.
`MapCanvas` already rebuilds on `retryKey`, so switching styles has a hook.

### TODO-67 `[ ]` Confirm the map's cold-load fix against a live tile server
The bug is fixed and the mechanism is understood; what is missing is one look at
it working.

**What was wrong:** every `setData` / `setPaintProperty` effect in `MapCanvas`
was guarded by `if (!map || !ready || !map.isStyleLoaded()) return;`.
`isStyleLoaded()` is a race rather than a state — it is false while the style is
still settling, and the `load` event that flips `ready` fires before it. Their
dependencies (the projected GeoJSON, a filter flag) do not change again on their
own, so a guard that failed once dropped the update **for good**: the stats rail
said 120 orders and the canvas had none. Confirmed live — the points appeared the
instant a filter chip was clicked, which is nothing but the effect running a
second time.

**The fix** is `whenStyleReady()`: apply now if the style can take it, otherwise
apply on the first `idle` or `styledata` that reports a loaded style. `idle` is
the load-bearing half — `styledata` only fires when the style *changes*, and by
that point it already had.

**Why it is still open:** OpenFreeMap stopped serving tiles part-way through
verifying (repeated reloads from one IP), so the last look at the fixed screen
was a blank canvas that proves nothing either way. It typechecks, lints and the
suite is green. Someone should open `/harta` on a cold cache and confirm the pins
are there *without* touching a filter — and ideally the same on a throttled
connection, which is the case that produced the bug.

### TODO-65 `[ ]` `web/`'s dependencies were declared but never installed
Found when the UI work would not typecheck: `lucide-react`, `@mantine/*`,
`class-variance-authority` and the rest of the rebuild's packages were in
`package.json` **and** in `package-lock.json`, but `web/node_modules` did not
have them — so `npm run dev`, `build`, `typecheck` and `lint` all failed on the
same "Cannot find module 'lucide-react'". `npm ci` fixed it and changed no
tracked file.

Nothing is wrong in the repo; this is a note for the next person who clones or
pulls the rebuild and finds every import red. Worth deciding whether it earns a
line in `README.md` next to the other setup steps, since the same trap is one
`git pull` away for anyone who had `web/node_modules` from before the rebuild.


### TODO-71 `[ ]` A second deploy target exists in `infra/` and is wired to nothing
Scaffolded on request: Terraform for GCP (Cloud Run + Cloud SQL Postgres +
Artifact Registry + Secret Manager + a least-privilege IAM pair) and Vercel (the
`web/` SPA), plus `.github/workflows/deploy-cloud.yml`.

`terraform fmt`, `init -backend=false` and `validate` all pass locally against
the real provider schemas — google 6.50.0, vercel 3.17.0, random 3.9.0, resolved
by Terraform 1.15.8 and pinned in `infra/.terraform.lock.hcl` for
windows/linux/darwin. So the configuration is syntactically and schema-correct.
**Nothing has been applied**, which is a different claim: there is no GCP
project and no Vercel account, so no resource has ever been created and no
`plan` has ever run against a real API.

`deploy.yml` (VPS + Caddy) is untouched and is still the live deployment. The
new workflow deliberately took a different filename rather than replacing it.

**What has to be decided before any of it is trusted:**

- **Is this replacing the VPS or sitting beside it?** Two live deployments mean
  two databases and two truths about the same customers. If it replaces, there
  is a data migration (H2/Postgres dump → Cloud SQL) that nothing here covers.
- **State is local.** `infra/providers.tf` has no `backend` block, so the
  workflow's `apply` would start from empty state on every run and fail on the
  second. A GCS bucket must exist and be wired in first; the workflow prints a
  warning until it is.
- **The identity that runs `terraform apply` in CI needs near-owner rights**,
  which is a strictly bigger grant than the deployer service account Terraform
  creates. `infra/README.md` lays out three options; none is chosen.
- **CORS becomes load-bearing.** On the VPS, Caddy serves the SPA and the API
  from one origin, so the browser never makes a cross-origin call. Split across
  Cloud Run and Vercel it does. `main.tf` computes
  `ECOTRACK_CORS_ALLOWED_ORIGINS` from the Vercel project name, which is a
  guess at the deterministic `*.vercel.app` alias — a custom domain or a renamed
  project silently breaks the frontend while the backend stays healthy.
- **Task photos still go to DigitalOcean Spaces.** Nothing GCS-shaped is
  scaffolded; the `DO_SPACES_*` values would have to be passed through
  `backend_env` / `backend_secrets`, which means the "GCP deployment" still
  depends on a DigitalOcean bucket.
- **`mobile/` is not covered.** It ships through EAS and would need
  `EXPO_PUBLIC_API_BASE_URL` repointed at the Cloud Run URL — and the hardcoded
  `http://146.190.224.202:8080/api` fallback in `constants/ApiConfig.ts` is
  still what installed builds fall back to.

Also unresolved: no monitoring or alerting, no rate limiting in front of Cloud
Run, and `db-f1-micro` is shared-core with no SLA, so the default tier is a
first-deploy choice rather than a production one.

---

## Appendix — current state (context)

- **Backend:** enrollment/device-approval auth is complete and tested; passwords
  and Google sign-in are fully removed, config included (TODO-23); `enforce`
  defaults to `true`; refresh tokens rotate on use.
- **Web:** enrollment flow shipped (TODO-01), Comenzi has the Curente/Arhivă
  split (TODO-21) and the Calendar (TODO-12).
- **Mobile:** enrollment shipped (TODO-19) — **the app can authenticate again**.
  Sales and Technical sections still present; TODO-33 plans to remove them.
- **Deploy:** `deploy.yml` (backend + web to VPS, one domain via Caddy) and
  `deploy-mobile.yml` (EAS OTA + builds). See `DEPLOYMENT.md`. `infra/` plus
  `deploy-cloud.yml` scaffold a second, **unused** target (Cloud Run + Cloud SQL
  + Vercel) that has never been run — TODO-71.
- **No users and no server exist yet**, so nothing here needs a migration path.
