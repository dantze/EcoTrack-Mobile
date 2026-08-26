# Handoff — CI / tests / deploy

Status: **complete**, second pass. The brief had three parts: (1) CI quality,
(2) real test coverage, (3) deploy safety. **All three are now done.**

Second pass finished the two things the first left open: the mobile test
project, and the entire deploy section. Both are described in place below —
look for "second pass".

---

## 1. CI — done

### `.github/workflows/ci-backend.yml` (rewritten)

| Change | What it now catches |
|---|---|
| `concurrency:` group keyed on `github.ref`, `cancel-in-progress` only for `pull_request` | A superseded PR run is cancelled; runs on `main` are never cancelled, so every pushed commit keeps its own result |
| `timeout-minutes: 20` | A hung Gradle daemon or wedged test can no longer burn 6 hours of runner time |
| `permissions: contents: read` | Least privilege. Deliberately NOT `checks: write` — results are surfaced via `$GITHUB_STEP_SUMMARY` and `::error` annotations, which need no extra scope |
| `gradle/actions/wrapper-validation@v4` step | A tampered `gradle-wrapper.jar` (a binary that runs before any of our code) |
| Test summary + coverage summary steps, `if: always()` | Test results and coverage are rendered on the run page even when the build FAILED, which is when they matter |
| `actions/upload-artifact@v4` on `if: failure()` for `build/reports/tests/test/` + `build/test-results/test/`, and `if: always()` for the JaCoCo report | The full HTML report of a failing run is downloadable for 14 days |
| `workflow_call:` trigger added | So `deploy-backend.yml` can call this workflow as its gate — **this is wired up in the workflow but the deploy side was never written. See "Not started".** |

Action versions are pinned to major tags (`@v4`), the officially supported
moving tags. Full-SHA pinning was considered and skipped; if you want it, do all
four workflows at once and add Dependabot for `github-actions`.

### `.github/workflows/ci-web.yml` (rewritten)

Same concurrency / timeout (15 min) / permissions treatment, plus the job now
runs **lint → typecheck → test → build** in that order (cheapest and most
specific signal first). Previously it ran typecheck + build only.

### `.github/workflows/ci-mobile.yml` (rewritten)

Same concurrency / timeout / permissions treatment, plus **lint** ahead of
typecheck. Previously typecheck only. The second pass added a **test** step and
a `workflow_call:` trigger — see "Mobile tests" below.

### `paths:` filters — PRESERVED on all three

CLAUDE.md says the per-project path filtering is the reason three projects can
share one repo. All three workflows keep theirs. `ci-backend.yml` additionally
watches `.github/scripts/*.py`, since those now run as part of the backend job.

### `.github/scripts/junit_summary.py` (new)

Parses Gradle's JUnit XML into a Markdown job summary (pass/fail/skip counts, a
failures table, a collapsed per-class table) and emits one `::error` workflow
command per failing test so failures appear as check annotations.

Deliberately a checked-in script rather than a marketplace action: no
`actions: write` permission needed, nothing extra to pin, and it runs locally
exactly as CI runs it. Always exits 0 — the Gradle step is what fails the job,
so a parsing hiccup can never turn a green build red.

```bash
python3 .github/scripts/junit_summary.py backend/build/test-results/test
```

### `.github/scripts/jacoco_summary.py` (new)

Summarises JaCoCo's CSV into the job summary: overall line/branch/instruction
percentages plus a per-package breakdown. **Report only, no threshold** — as the
brief required.

```bash
python3 .github/scripts/jacoco_summary.py backend/build/reports/jacoco/test/jacocoTestReport.csv
```

### Linting — new, and clean

**`web/eslint.config.js`** (new, flat config): `@eslint/js` recommended +
`typescript-eslint` recommended + `eslint-plugin-react-hooks` +
`eslint-plugin-react-refresh`, wired to `npm run lint` / `npm run lint:fix`.

**`mobile/eslint.config.mjs`** (new — `.mjs`, because `mobile/package.json` has
no `"type": "module"`), wired to `npm run lint` / `npm run lint:fix`.

Both are at **0 errors**. Warnings are deliberate and documented inline:

- Type-aware linting (`recommendedTypeChecked`) is NOT enabled — ~10x the
  findings, mostly noise, and it triples lint time. `npm run typecheck` already
  runs the compiler over the same files.
- `eslint-plugin-react-hooks` v7 ships the **React Compiler** diagnostics, which
  are far stricter than the classic v4/v5 rules. `rules-of-hooks` and
  `exhaustive-deps` stay **errors** (they catch genuine bugs). The compiler-era
  rules (`set-state-in-effect`, `refs`, `immutability`, `globals`,
  `preserve-manual-memoization`, and on mobile also `purity`,
  `static-components`) are downgraded to **warnings with a comment** — clearing
  them means restructuring most of the feature layer. Promote them back to
  `error` file-by-file.
- `@typescript-eslint/no-explicit-any` is a warning in both projects.
- `@typescript-eslint/no-require-imports` is **off** in mobile only:
  `require('./assets/x.png')` is how Metro resolves a static asset; the rule is
  simply wrong for React Native, and a warning would never be actionable.

Current counts: **web 66 warnings, mobile 123 warnings, 0 errors in both.**

### Real lint violations that were fixed (not suppressed)

**web** (3, all minimal and re-read immediately before editing, since another
agent was rewriting `web/src` in parallel):
- `web/src/components/ui/DataTable.tsx` — removed unused `RowKey` import
- `web/src/features/sales/OrdersPage.tsx` — removed unused `OrderTypeTag` import
- `web/src/features/sales/ClientsPage.tsx` — `let hasOrders = false` → `let hasOrders: boolean` (the initialiser was provably never read)

**mobile** (45 errors → 0). Mechanical, zero behaviour change: dead imports and
unused locals across 14 screens, two `prefer-const`, one unused `catch (error)`
binding. Plus three genuine bugs:

1. **`mobile/app/login.tsx`** — the component was `const login = () => {…}`.
   React only treats PascalCase functions as components, so every hook inside it
   was a "hook called outside a component" violation. Renamed to `Login`
   (default export; expo-router does not care about the name).
2. **`mobile/app/Sales/EditClient.tsx`** — `if (!clientData) return <error/>`
   sat ABOVE twelve `useState` calls. A render without the `client` param ran
   zero hooks; a render with it ran twelve. That is the classic "Rendered fewer
   hooks than expected" crash on the transition. The guard now sits BELOW every
   hook and the initialisers use `clientData?.x`.
3. **`mobile/app/Sales/EditOrder.tsx`** — same bug, same fix (three `useState`
   calls; nothing above the guard reads `orderData`, so no optional chaining was
   needed).

`@ts-ignore` → `@ts-expect-error` with descriptions in
`mobile/services/ClientService.ts` and `mobile/services/PhotoService.ts` (×2);
`npm run typecheck` confirms all three directives are actually needed.

---

## 2. Tests — done

### Backend: JaCoCo

`backend/build.gradle`:
- added the `jacoco` plugin (toolVersion 0.8.13)
- `test` now emits JUnit XML + HTML and is `finalizedBy jacocoTestReport`
- `jacocoTestReport` emits xml + **csv** (the CSV is what the summary script
  reads) + html, excluding `DamiProdApplication` and `dto/**`
- **No `violationRules`, no `jacocoTestCoverageVerification` wired into
  `check`** — report only, as the brief required. There is a comment in the
  file explaining why.

Current coverage: **67.0% lines, 46.9% branches, 64.9% instructions.**

### Backend: 71 new tests across 7 new classes

All under `backend/src/test/java/com/example/damiProd/`. None of the auth
agent's files (`SecurityTests/**`, `ServiceTests/{Token,Auth,GoogleAuth}…`) were
touched.

| File | Tests | Which "Known gap" / risk it pins |
|---|---|---|
| `DomainTests/OrderJsonSubTypesTest.java` | 8 | The `@JsonSubTypes` dispatch for `Amplasari`/`Ridicari`/`Igienizari`. The discriminator strings are duplicated in `web/src/features/sales/orderModel.ts` and `mobile/types/OrderTypes.ts`; renaming one now fails here first. Also pins that an unknown `orderType` is REJECTED (no `defaultImpl`), so adding a fourth type must touch the `@JsonSubTypes` list, and that `recurringPlan` is `@JsonIgnore`d in favour of `recurringPlanId`. Uses the ObjectMapper Spring Boot actually builds, not a bare `new ObjectMapper()`. |
| `DomainTests/ClientJsonSubTypesTest.java` | 8 | `Client → Individual/Company` dispatch. **Found a real bug — see below.** |
| `RepositoryTests/OrderRepositoryTest.java` | 10 | JOINED inheritance (polymorphic finders return concrete subclasses; subtype-scoped JPQL does not see siblings) and the **Ridicare availability SUM queries**: COALESCE-vs-null, per-client/location/product scoping, and that the two halves join on DIFFERENT keys (`product.name` vs the denormalised `pickupProductName`), so renaming a Product retroactively shifts what is considered "placed" at a site. |
| `RepositoryTests/TaskRepositoryTest.java` | 11 | **`Task` has three independent nullable parents.** Proves a task can persist with all three null OR all three set, and that every per-parent finder then claims it. Also pins `findByRouteAndDay`'s scheduledDate-OR-scheduledTime split, that the employee finders INNER JOIN through `route` (so a routeless task is invisible to every driver), and the `deleteNonCompletedByRecurringPlanId` vs `deleteByRecurringPlan_Id` distinction. |
| `RepositoryTests/ConcurrencyGapsTest.java` | 6 | **The two headline "Known gaps", as characterisation tests that assert the wrong-but-current behaviour on purpose.** See below. |
| `SchedulerTests/RecurringTaskSchedulerTest.java` | 6 | The 02:00 nightly top-up. Asserts the cron really fires daily at 02:00 (parsed with `CronExpression`), that only `findByActiveTrue()` plans are considered, that routeless plans are skipped, and — the one that matters — that **one failing plan does not abort the rest of the run**, so a broken plan cannot leave the whole fleet with empty routes. |
| `ServiceTests/RecurringIgienizareServiceTest.java` | 22 | Task generation: the 90-day `LOOKAHEAD_DAYS` window for indefinite plans, frequency spacing, that `isIndefinite=false` with a null `endDate` is ALSO treated as indefinite, the `existsByRecurringPlan_IdAndScheduledDate` idempotency guard, `lastGeneratedDate` making a second run a near no-op, the `Company`/`Individual` downcast for `clientName` (and the `"Client necunoscut"` fallback), and `create`/`assignRoute`/`deactivate`/`delete`. |

#### `ConcurrencyGapsTest` — the two demonstrated bugs

These tests **assert the bug**. When someone fixes the underlying gap the test
fails loudly and should be inverted, rather than the fix landing unnoticed.
Every test carries a `@DisplayName` starting `GAP 1:` or `GAP 2:`.

**GAP 1 — no `@Version` optimistic locking anywhere.**
- `noEntityDeclaresAVersionField` — reflects over all 14 entities and asserts
  that NONE has `@Version`. Adding one anywhere trips this.
- `lastWriteWins_alsoLosesFieldsTheSecondWriterNeverTouched` — **demonstrates
  the lost update.** Two users load the same task; the dispatcher edits
  `internalNotes` and saves; the driver, holding the stale copy, only marks it
  `COMPLETED`. The reload shows the note silently reverted — because Spring Data
  `save()` issues a full-row UPDATE from a stale snapshot. No error anywhere.

**GAP 2 — `OrderService.createOrder` is not `@Transactional`; the Ridicare
availability check is a read-then-write race.**
- `readThenWriteRace_twoConcurrentPickupsBothPassAndOverdrawTheSite` —
  **demonstrates the race.** 5 cabins placed at a site; two pickup requests for
  3 and 4 both pass the check (each read `available = 5` before the other's save
  landed) and both persist. Available goes to **−2**, and every subsequent
  legitimate pickup at that site is refused. The interleaving is reproduced
  deterministically rather than with threads, because H2-here-vs-Postgres-there
  (`ddl-auto=update`, no migration tool) means a timing test would prove nothing
  about production. That caveat is in the file's javadoc.
- `createOrderIsNotAnnotatedTransactional` — asserts the annotation is absent,
  so whoever adds it is sent back to invert the race test.
- Plus: the check correctly rejects an over-claim when nothing interleaves, and
  is **skipped entirely** when any of its three inputs is null (a 999-unit
  pickup with no coordinates is created without complaint).

#### Two real bugs found while writing these tests

**(a) `Individual.CNP` is dropped in live mode, in BOTH directions.**
`Company.CUI` carries an explicit `@JsonProperty("CUI")`; `Individual.CNP` does
not, so Jackson bean-names it and the wire actually carries lowercase **`cnp`**.
Meanwhile `web/src/api/live/normalize.ts` declares `CNP` on `RawClient` and
reads `raw.CNP`. Because `Client` is `@JsonIgnoreProperties(ignoreUnknown =
true)`, a client POSTing `"CNP"` has the value silently discarded — no 400, no
log line, just a null column. **Not fixed** (needs a coordinated backend + web +
mobile change). Pinned from both sides:
- `ClientJsonSubTypesTest#individualCnp_sentAsUppercase_isSilentlyDropped`
- `ClientJsonSubTypesTest#individualSerialisation_emitsLowercaseCnpOnly`
- `web/.../normalize.test.ts` → "LOSES an individual CNP that arrives under the
  real lowercase wire name"

**(b) `Company` serialises its registration code TWICE**, as both `CUI` (from
the field annotation) and `cui` (from the Lombok getter). The web client reads
`CUI` so it works, but removing either spelling breaks one of the clients.
Pinned by `companySerialisation_emitsCuiUnderBothSpellings`.

**(c) `DataTable` sort comment contradicts its code.**
`web/src/components/ui/utils.ts#compareValues` genuinely sinks nulls, but
`DataTable` multiplies the result by the direction factor before using it, which
flips the null handling too — so on a DESCENDING sort empty cells float to the
TOP, contradicting the "Nulls sink to the bottom in both directions" comment
right above that line. Pinned as current behaviour in the DataTable test with a
javadoc explaining the fix (compare before applying the factor).

### Web: Vitest + React Testing Library + jsdom

- `web/vite.config.ts` — added a `test:` block: jsdom, `globals: false`
  (describe/it/expect imported explicitly), `setupFiles`, v8 coverage with
  **no thresholds**, and `env: { VITE_MOCK_LATENCY_MS: '0' }` so the mock API's
  220 ms artificial delay does not turn ~150 calls into 30 s of wall clock.
  Vitest reuses the Vite config, so the `@` alias resolves in tests exactly as
  in the app — which matters, because "feature code imports only `@/api`" is
  what keeps mock and live substitutable.
- `web/src/test/setup.ts` — jest-dom matchers, automatic RTL cleanup, and stubs
  for `matchMedia` / `ResizeObserver` / `IntersectionObserver` /
  `scrollIntoView` (none exist in jsdom). Deliberately nothing that changes app
  behaviour.
- `web/package.json` — added `test`, `test:run`, `test:coverage`, `lint`,
  `lint:fix`.

**Suites written this session (100 tests):**

| File | Tests | Covers |
|---|---|---|
| `web/src/api/live/__tests__/normalize.test.ts` | 39 | CLAUDE.md calls `normalize.ts` "where the web app breaks" when a backend entity's JSON shape changes. Payloads are written to match what Spring actually serialises: transient `…Id`/`…Name` getters instead of `@JsonIgnore`d associations, `Order.date` as a `java.util.Date` in both ISO and epoch-millis form, and — as the brief asked — **the `/api/employees` entity shape (roles as `{id, roleName}` objects) vs the `/api/admin/employees` DTO shape (roles as strings), asserted to produce an identical `Employee`.** Plus the acyclic task→route→tasks graph that TanStack's structural sharing walks. |
| `web/src/mocks/__tests__/contract.test.ts` | 33 | The mock satisfying `EcoTrackApi` **behaviourally**, not just structurally (TypeScript already proves the shapes). Every resource group and method exists; the token handshake incl. refresh rotation killing the old token; writes visible to the next read; the three error cases the UI must render (client with orders → 409, product in use → 409, second task for one order → 409); `statusForOrder` returning an object not a boolean; and the cascades (deleting a route unassigns its tasks rather than destroying them; `reorderTasks` takes a bare array and renumbers from 0). |
| `web/src/components/ui/__tests__/DataTable.test.tsx` | 19 | The one UI component with real logic. Sorting (asc → desc → unsorted), `aria-sort`, that an unsortable column renders no button at all, empty state vs loading skeleton, row clicks, and controlled multi-select incl. the header select-all. Written against roles/text, never class names, because the UI is being restyled in parallel. |
| `web/src/features/sales/__tests__/validation.test.ts` | 29 | The Sales validation rules, which are a claimed 1:1 port of `mobile/utils/validation.ts` + `formatters.ts`. If they drift, a client record created on one device fails validation on the other. Includes the Romanian message wording, comma decimals, and the `splitPhone` longest-code-first / legacy `07XXXXXXXX` → `+40` handling. |
| `web/src/features/sales/__tests__/FilterBar.test.tsx` | 9 | The filter strip shared by all four Sales screens. Focuses on the accessibility contract, which is invisible in a browser: the search box's accessible name, and that passing `controls` promotes it to a full ARIA combobox while omitting it leaves those attributes **absent rather than empty**. |

> Note: `web/src/` now contains 10 test files / 216 tests. The other five
> (`Autocomplete`, `suggestions`, `grouping`, `recents`, `search`) were added by
> a different agent working in parallel — they are not mine and I did not review
> them.

### Mobile tests — wired (second pass)

`jest-expo` was judged not worth it and still is: it pulls a full RN preset and
transform chain for a codebase whose testable logic is a handful of pure
modules. `mobile/utils/*` and `mobile/types/OrderTypes.ts` import nothing from
react-native, so a plain node-environment Vitest project runs them with no
transform at all. `vitest` was already a devDependency.

Added:

- **`mobile/vitest.config.ts`** — `environment: 'node'`, and
  `include: ['{utils,types,constants}/**/*.test.ts']`. **Keep that glob narrow**:
  widening it to `**/*.test.ts` starts pulling in files that import react-native
  and the whole reason this config is cheap disappears.
- **`"test"` / `"test:run"`** in `mobile/package.json`.
- **A `Test` step in `ci-mobile.yml`**, after lint and typecheck, plus a
  `workflow_call:` trigger to match the other two CI workflows.
- **59 tests across 5 files**, all passing:

| File | Tests | Covers |
|---|---|---|
| `utils/__tests__/orderUtils.test.ts` | 30 | `getDateInfo` — three subtypes each keeping their date under a different field, and only Amplasare able to produce a range. Ranges, same-day collapse, unparseable and missing dates, plus `getClientName` / `getLocationText` / `getActionText` / `getOrderTypeLabel` / `formatDate`. |
| `utils/__tests__/formatters.test.ts` | 11 | ro-RO price grouping, and the three validators — including the `parseFloat`/`parseInt` edge behaviour (`'12abc'` passes, `'2.9'` truncates) pinned as **current behaviour** rather than asserted as correct. |
| `utils/__tests__/validation.test.ts` | 7 | The email/phone rules, which are also ported into `web/src/features/sales/validation.ts`. If they drift, a client record created on a phone fails validation on the web app. |
| `utils/__tests__/dateUtils.test.ts` | 7 | `toDateString` and the Romanian display formats. |
| `types/__tests__/OrderTypes.test.ts` | 4 | The three discriminator strings, duplicated in the backend's `@JsonSubTypes`, `web/src/features/sales/orderModel.ts` and here. The backend half is pinned by `DomainTests/OrderJsonSubTypesTest`; this is the mobile half. |

#### The timezone pin — read this before touching the date tests

`vitest.config.ts` sets `env: { TZ: 'Europe/Bucharest' }`, and that is
load-bearing, not tidiness. The date code is timezone-sensitive in two places
and would otherwise pass locally and fail in CI (GitHub runners are UTC):

- `orderUtils.getDateInfo` parses `'YYYY-MM-DD'` with `new Date(s)`, which
  JavaScript reads as **UTC midnight**, then reads it back with the **local**
  `getDate()`/`getMonth()`. Anywhere west of UTC, every bare date renders one
  day early. Invisible to users in Romania, who are always east of UTC.
- `dateUtils.toDateString` uses `toISOString()`, so at 00:30 local in Bucharest
  it returns **yesterday's** date. A task filed late in the evening is filed
  against the wrong day.

Both are pinned as current behaviour by named tests
(`dateOffByOneWestOfUtc`, `utcNotLocal`). **They are real latent bugs.** Fixing
either means inverting its test — which is the point.

## 3. Deploy — done (second pass)

All three original problems in `.github/workflows/deploy-backend.yml` are fixed,
and the four missing pieces are written.

### `deploy-backend.yml` — rewritten

**1. It no longer ships untested code.** A `verify` job now
`uses: ./.github/workflows/ci-backend.yml`, and `deploy` has `needs: verify`.
The VPS build keeps `-x test`, which is defensible *only* because of that job —
the same commit already ran the full suite on a clean runner. There is a comment
saying exactly that, so nobody removes the gate and leaves the `-x`.

This deliberately duplicates the `ci-backend` run that a push to main triggers
on its own. Deduplicating would mean making the deploy depend on some *other*
workflow run having happened, which is the coupling that lets an untested commit
through the moment it breaks.

**2. It no longer echoes credentials.** The `echo "DB_URL=$DB_URL"` /
`echo "DB_USER=$DB_USER"` lines are gone, replaced by a comment explaining why
they must not come back: GitHub masks a secret only when the value matches
exactly, so any reformatted or partial echo lands in the run log in the clear.

**3. "PID alive after 15s" is replaced by a real health poll.** `wait_for_health`
polls `http://127.0.0.1:8080/actuator/health` — localhost, so no firewall change
and no new secret — up to 60 times at 2 s, succeeding only on `"status":"UP"`.
A Spring Boot process that cannot reach its database stays alive indefinitely
while serving nothing; the actuator answers 503 for exactly that case. Falls
back to `wget` if `curl` is absent and fails loudly if neither exists.

**4. Rollback.** Before anything else, the currently-running jar is copied to
`~/releases/previous.jar`. If the new build never reports healthy, the script
copies the log aside to `~/app.failed.log` **first** (the restart truncates
`~/app.log`, which would destroy the evidence), prints the last 50 lines, stops
the new process, restarts the previous jar through the same `start_app` helper
— one definition, so a rollback starts the old jar exactly the way the new one
was started — and re-polls. **The run exits 1 either way**: a successful
rollback is still a failed deploy.

A failed `./gradlew build` on the server takes the same path.

Also: `concurrency: { group: deploy-backend-production, cancel-in-progress: false }`
so deploys queue instead of racing and none is ever cancelled mid-flight (a
cancelled deploy leaves a stopped service and no rollback), `permissions: contents: read`,
and `command_timeout` raised 10m → 20m because 10m could not survive a rollback.

### `deploy/systemd/` — written, NOT installed

`ecotrack-backend.service` + `README.md`. Documentation with a copy-paste path;
production keeps using `nohup` until someone decides otherwise, and the README
says so twice.

The strongest argument for switching is one the README spells out: **the current
`nohup` invocation passes `--spring.datasource.password=...` and three
DigitalOcean keys as argv entries**, readable by any local user via `ps aux` or
`/proc/<pid>/cmdline`. The unit uses a root-owned `0600` `EnvironmentFile`
instead. It also adds restart-on-crash, restart-on-reboot and journal log
rotation, and carries the usual hardening directives.

What it does **not** fix, also in the README: `Type=simple` reports "started" the
moment the JVM execs, so systemd knows nothing about whether Spring finished
wiring. **Keep the workflow's health poll and rollback** if you migrate.

### `deploy-web.yml` — new, `workflow_dispatch` only

Deliberately no `push:` trigger, with the reason at the top of the file:
CLAUDE.md's — the production backend is plain HTTP on a bare IP, so a browser
refuses to call it from an HTTPS origin, and a deployed live build cannot work
until the backend has TLS. It gates on `ci-web.yml`, builds with a
`data_mode` choice input (`mock` default), emits a `::warning` when `live` is
chosen, and **uploads a dist artifact rather than publishing anywhere**. Wiring
it to a host is a decision that comes after TLS.

### `repo-hygiene.yml` + `.github/scripts/repo_hygiene.py` — new

Runs on **every** pull request with **no `paths:` filter** — that is the whole
point. The three CI workflows are each path-filtered (load-bearing, per
CLAUDE.md), which leaves changes outside all three with no CI at all.

Four checks:

1. **`gradle/actions/wrapper-validation@v4`** — also in `ci-backend.yml` so a
   backend PR fails fast; here so a PR touching *only* the wrapper, which no
   path filter catches, cannot slip through.
2. **Key material by filename** — `.env`, `*.pem`, `*.key`, `*.p12`, `*.jks`,
   `id_rsa`, `google-services.json`, service-account JSON. `.env.example` and
   friends are exempt.
3. **Credential shapes by content** — Google API keys, AWS access key ids,
   GitHub PATs, private-key blocks, Slack tokens. Patterns are assembled from
   string fragments so the script does not trip its own scan.
4. **CI coverage** — every changed path must match some `ci-*.yml` `paths:`
   filter or sit under an explicit `NO_CI_REQUIRED` allowlist. This is the check
   that catches "someone added a new top-level project and it silently has zero
   CI forever".
5. **No action pinned to `@main`/`@master`.**

Plus a `yaml.safe_load` pass over every workflow file.

**Unlike `junit_summary.py` and `jacoco_summary.py`, this script's exit code is
the point** — those always exit 0 because Gradle fails the job; this one returns
1 on a violation. There is a comment saying so.

Runs locally exactly as in CI:

```bash
git diff --name-only origin/main... | python3 .github/scripts/repo_hygiene.py
```

#### It found something on its first run

`mobile/google-services.json` is committed and carries a Google API key
(`AIzaSyCzzT…`, project `ecotrack-ae5f1`, package `com.damiprod.ecotrack`).

This is **not** the leaked Maps key from `HANDOFF-auth-security.md` — different
key, different problem. A Firebase Android config is *designed* to be committed
and shipped inside the APK; anyone with the app has it. So it is allowlisted in
`.github/repo-hygiene-allow.txt` rather than treated as a leak.

**What still needs checking by a human: that the key is restricted in Google
Cloud** to the package name `com.damiprod.ecotrack` plus the release signing
SHA-1. Unrestricted, it is a billable key anyone can extract from the APK.

#### `.github/repo-hygiene-allow.txt`

Two entries, both with reasons and both meant to be deleted when they stop being
true: the Firebase config above, and the leaked Maps key quoted in
`HANDOFF-auth-security.md` (already in git history from `807aec2`; the line says
to delete it once the key is rotated).

## Verification — real results, second pass

> ⚠️ **There is no JDK on the default PATH on this machine** (`java -version`
> fails). Use
> `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.

| Command | Result |
|---|---|
| `cd backend && ./gradlew build` | ✅ **BUILD SUCCESSFUL — 223 tests, 0 failures** |
| JaCoCo | ✅ report generated. No threshold gates the build. |
| `cd web && npm run typecheck` | ✅ exit 0 |
| `cd web && npm run lint` | ✅ **0 errors**, 71 warnings |
| `cd web && npm run test:run` | ✅ **10 files, 216 tests, all passing** |
| `cd web && npm run build` | ✅ exit 0 — **the >500 kB warning is gone**, see the UI/UX handoff |
| `cd mobile && npm run typecheck` | ✅ exit 0 |
| `cd mobile && npm run lint` | ✅ **0 errors**, 123 warnings |
| `cd mobile && npm run test:run` | ✅ **5 files, 59 tests, all passing** (was: did not exist) |
| `TZ=America/Los_Angeles … npm run test:run` | ✅ still 59/59 — confirms the TZ pin actually overrides the shell |
| All 6 workflow YAML files | ✅ parse |
| `repo_hygiene.py` over all 347 tracked files | ✅ **OK, 0 problems** (after allowlisting the Firebase config) |
| `repo_hygiene.py` fault injection | ✅ correctly returns **1** and annotates for a planted API key, a committed `.env`, an un-CI'd top-level path, and an action pinned `@main` |
| All 3 `.github/scripts/*.py` | ✅ compile |

Nothing above is described as passing without having been run.

The backend test count moved 212 → 223 across both passes: +13 from the auth
hardening work (see `HANDOFF-auth-security.md`), −2 from `EmployeeServiceTest`
when `saveEmployee`/`deleteEmployee` were deleted with the endpoints that used
them.

`actionlint` is **still not installed** on this machine, so workflow YAML was
validated with `yaml.safe_load`. That catches syntax errors but not
GitHub-Actions schema mistakes — **worth an `actionlint` run before merging**,
and the deploy workflow is the one that most deserves it.

`snyk` is **still not installed** on PATH, so the scan required by
`.github/instructions/snyk_rules.instructions.md` has **not** run against any of
this — including the new `repo_hygiene.py`.

## Inactive pending user action

Nothing added across either pass requires a new GitHub secret or a server change
to work. Four things are worth knowing:

1. **The first deploy after this merges will have no rollback target.** The
   rollback copy is made from the jar already on the box, and `~/releases/` does
   not exist yet. The script says "this looks like a first deploy" and carries
   on; from the second deploy onwards rollback is live.
2. **`/actuator/health` is now actually polled.** If the VPS firewall exposes
   port 8080 publicly the endpoint is publicly reachable — harmless
   (`{"status":"UP"}`, no details, no components), but a conscious nod is worth
   it. The poll itself uses `127.0.0.1`, so no firewall change is needed.
3. **`curl` or `wget` must exist on the VPS.** The health poll needs one; it
   fails with a clear message if neither is present. Almost certainly fine — the
   box already runs git and a JDK — but it is a new dependency of the deploy.
4. **Verify the Firebase key restrictions** in Google Cloud (see the
   repo-hygiene section). Nothing breaks either way; an unrestricted key is
   someone else's billable quota.

The systemd unit is written but **not installed**, and installing it stays a
manual, opt-in step. The workflow keeps using `nohup`.

No secret names, VPS paths, or GitHub configuration were changed.

## Gotchas

- **Another agent was editing `web/src/**` in parallel throughout this session.**
  If `npm run lint` or `npm run test:run` fails for you, check `git diff` before
  assuming it is one of these changes — files moved under me more than once. The
  five web test files I did **not** write are listed above. My three `web/src`
  edits were single-line and re-read immediately before editing.
- **A third agent was editing `backend/src/test/SecurityTests/**` and
  `ServiceTests/{Token,Auth,GoogleAuth}ServiceTest.java`.** Those were left
  alone by design. Mid-session, concurrent `./gradlew` runs from both agents
  produced spurious `Could not write XML test results for …` errors — that is
  two Gradle processes racing on `build/test-results/`, not a real failure.
  Re-run serially if you see it.
- `web/src/mocks/store.ts` exports `db` as a **module-level singleton**. Vitest
  isolates modules per test file, so each file gets a fresh seed, but tests
  **within** one file share a database. `contract.test.ts` therefore creates the
  rows it needs and asserts deltas rather than totals — keep that discipline
  when adding to it.
- `eslint-plugin-react-hooks` resolved to **v7**, which is a much bigger
  behaviour change than the version number suggests: it ships the React Compiler
  diagnostics. If you pin it back to v5 the warning count drops to near zero and
  the downgraded rules in both configs become dead entries.
- `mobile/eslint.config.mjs` must keep the `.mjs` extension unless you add
  `"type": "module"` to `mobile/package.json`.
- The backend `jacocoTestReport` reads a `.exec` file produced by the `test`
  task. If you run `jacocoTestReport` alone after a partial test run you will
  get a misleadingly low number — always run `test jacocoTestReport` together,
  which is what `finalizedBy` does automatically.

### Gotchas added by the second pass

- **`start_app` in `deploy-backend.yml` truncates `~/app.log`.** The rollback
  path copies it to `~/app.failed.log` *before* restarting for that reason. If
  you reorder those lines you silently destroy the only evidence of why a deploy
  failed.
- **The deploy script must stay POSIX-sh compatible.** `appleboy/ssh-action`
  runs it through the login shell, so it avoids `local`, arrays and `set -e` —
  the last one deliberately, because the rollback path needs to handle failures
  itself rather than abort on them.
- **`repo_hygiene.py` skips itself when content-scanning.** It holds the
  credential regexes, so scanning itself would always fail. If you move those
  patterns into another file, add that file to the skip list too.
- **PyYAML parses a bare `on:` key as the boolean `True`** (YAML 1.1). The
  CI-coverage check reads `data.get('on', data.get(True))` for that reason —
  do not "simplify" it.
- **`mobile/vitest.config.ts` pins `TZ`.** Removing it makes two date tests pass
  in Bucharest and fail on a UTC runner. See the mobile tests section.
- **The mobile Vitest `include` glob is intentionally narrow.** Widening it to
  `**/*.test.ts` pulls in react-native imports and the config stops being
  transform-free.
