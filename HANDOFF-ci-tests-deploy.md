# Handoff — CI / tests / deploy

Session stopped early. Everything described under **Done** is finished and
verified; everything under **Not started** is untouched. Working tree only —
nothing committed.

The brief had three parts: (1) CI quality, (2) real test coverage, (3) deploy
safety. **Parts 1 and 2 are largely done. Part 3 is NOT STARTED — the deploy
workflow still has all three of its original problems.**

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
typecheck. Previously typecheck only.

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

### Mobile tests — NOT wired (deliberate, low-friction path identified)

`jest-expo` was judged not worth it: it pulls a full RN preset and transform
chain for a codebase whose testable logic is four pure modules.

**But it is NOT high-friction, and the next session should just do it.**
`mobile/utils/{validation,formatters,dateUtils,orderUtils}.ts` and
`mobile/types/OrderTypes.ts` import nothing from React Native — `orderUtils`
imports only type guards from `OrderTypes`. A plain node-environment Vitest
project runs them with no transform at all.

`vitest` is **already installed** as a mobile devDependency. What is missing:
1. `mobile/vitest.config.ts`:
   ```ts
   import { defineConfig } from 'vitest/config';
   export default defineConfig({
     test: { environment: 'node', include: ['{utils,types,constants}/**/*.test.ts'] },
   });
   ```
2. `"test": "vitest"` / `"test:run": "vitest run"` in `mobile/package.json`
   (deliberately NOT added yet, so no script points at a missing config).
3. Tests for `orderUtils.getDateInfo` (the range/single-day/invalid branches are
   the fiddly part), `getClientName`, `validation`, `formatters`, `dateUtils`.
4. A `npm run test:run` step in `.github/workflows/ci-mobile.yml`.

---

## 3. Deploy — NOT STARTED

**`.github/workflows/deploy-backend.yml` is UNCHANGED. All three problems from
the brief are still live:**

1. ❌ **Still builds with `./gradlew build -x test`** on the VPS — ships
   untested code. `ci-backend.yml` now has a `workflow_call:` trigger ready to
   be used as the gate, but nothing calls it.
2. ❌ **Still echoes credentials into the run log** —
   `echo "DB_URL=$DB_URL"` and `echo "DB_USER=$DB_USER"` at the top of the SSH
   script. These are secret-masked by GitHub only if the exact secret value
   matches; the log line is still wrong and should just be deleted.
3. ❌ **Still treats "PID alive after 15s" as success.** A Spring Boot process
   that fails its DB connection can stay alive for far longer than 15 s while
   serving nothing.

Also not started: **rollback to the previous jar on failure**, the checked-in
**systemd unit + install README**, the **`workflow_dispatch`-gated web deploy
workflow**, and the **repo-hygiene workflow**.

### One piece of deploy groundwork IS done and IS active

To make a real health poll possible, the actuator was added. **This is live and
takes effect on the next deploy even though nothing polls it yet:**

- `backend/build.gradle` — added `org.springframework.boot:spring-boot-starter-actuator`
- `backend/src/main/resources/application.properties` — appended:
  ```properties
  management.endpoints.web.exposure.include=health
  management.endpoint.health.show-details=never
  management.endpoint.health.show-components=never
  ```

Only `/actuator/health` is exposed and it shows no details, so it adds no
readable surface beyond `UP`/`DOWN`. `SecurityConfig` leaves non-`/api` paths
`permitAll` in **both** enforcement modes, so no security config change was
needed. Health returns 503 when the DB is unreachable — exactly what a deploy
gate wants.

**`ecotrack.security.enforce` was NOT touched anywhere.** It remains `false` in
`application.properties` and unset in `application-prod.properties`.

### The deploy work, in the order I would do it next

1. **Delete the two `echo "DB_…"` lines.** One minute, no risk, do it first.
2. **Gate on CI.** Add a `verify` job to `deploy-backend.yml` that
   `uses: ./.github/workflows/ci-backend.yml`, and `needs: verify` on the
   `deploy` job. Keeping `-x test` on the VPS is then defensible (the same
   commit was already tested on the runner) — but say so in a comment.
3. **Replace the PID check with a health poll**, run over the existing SSH
   session against `http://127.0.0.1:8080/actuator/health` (localhost, so no
   firewall change and **no new secrets**). Retry loop, ~60 attempts at 2 s,
   succeed on `"status":"UP"`.
4. **Rollback.** Before `./gradlew build`, `cp` the current
   `build/libs/*.jar` (excluding `*-plain.jar`) to `~/releases/previous.jar`. On
   health-poll failure: kill the new PID, restart from `previous.jar` with the
   same argument list, re-poll, `tail -50 ~/app.log`, exit 1.
5. **systemd unit + README** as the documented alternative to `nohup`, checked
   in but not installed — e.g. `deploy/systemd/ecotrack-backend.service` and
   `deploy/systemd/README.md`. Do NOT change how the box runs; document it.
6. **`.github/workflows/deploy-web.yml`** — `workflow_dispatch:` **only**, with a
   comment stating CLAUDE.md's reason: the production backend is plain HTTP on a
   bare IP, so a deployed HTTPS build cannot call it until the backend has TLS.
7. **`.github/workflows/repo-hygiene.yml`** — runs on EVERY pull request with
   **no** `paths:` filter (this is the gap the three path-filtered workflows
   leave open). Should check: `gradle/actions/wrapper-validation@v4`; no `.env`
   or key material committed; every changed top-level path is covered by one of
   the three CI workflows' filters; no action referenced as `@main`/`@master`.

---

## Verification — real results, run at end of session

```
cd backend && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew build
```
> ⚠️ **There is no JDK on the default PATH on this machine** (`java -version`
> fails). Homebrew's is at `/opt/homebrew/opt/openjdk@21`. Setting
> `JAVA_HOME` to that prefix works with the Gradle toolchain; if your Gradle
> version needs a real JDK home, use
> `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.

| Command | Result |
|---|---|
| `cd backend && ./gradlew build` (with `JAVA_HOME` set) | ✅ **BUILD SUCCESSFUL** |
| `cd backend && ./gradlew test --rerun-tasks` | ✅ **212 tests, 0 failed, 0 skipped**, 26 classes, 28 s |
| JaCoCo | ✅ report generated — **67.0% lines / 46.9% branches / 64.9% instructions**. No threshold gates the build. |
| `cd web && npm run typecheck` | ✅ exit 0 |
| `cd web && npm run lint` | ✅ exit 0 — **0 errors, 66 warnings** |
| `cd web && npm run test:run` | ✅ **10 files, 216 tests, all passing**, 2.6 s |
| `cd web && npm run build` | ✅ exit 0 (pre-existing "chunks larger than 500 kB" advisory, not new) |
| `cd mobile && npm run typecheck` | ✅ exit 0 |
| `cd mobile && npm run lint` | ✅ exit 0 — **0 errors, 123 warnings** |
| `cd mobile && npm run test:run` | ⛔ **does not exist** — see "Mobile tests" above |
| All 4 workflow YAML files | ✅ parse (`python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))"`) |
| Both `.github/scripts/*.py` | ✅ compile, and were run against real build output |
| Both eslint configs | ✅ import cleanly under Node |

Nothing is failing. Nothing above is described as passing without having been run.

`actionlint` is **not installed** on this machine, so workflow YAML was
validated with the Python `yaml.safe_load` fallback the brief specified. That
catches syntax errors but not GitHub-Actions-specific schema mistakes — worth a
run of `actionlint` before merging.

`snyk` is **not installed** on PATH, so the code scan required by
`.github/instructions/snyk_rules.instructions.md` was **skipped**. It needs
running against the new first-party code (the two Python scripts, the new test
files) before merge.

---

## Inactive pending user action

Nothing added this session requires a new GitHub secret or server change to
work. Two items are worth knowing:

1. **The actuator health endpoint is live but nothing polls it.** After the next
   deploy, `http://<VPS>:8080/actuator/health` will answer. If the VPS firewall
   exposes port 8080 publicly, that endpoint becomes publicly reachable —
   harmless (`{"status":"UP"}`, no details, no components) but worth a conscious
   nod. The planned deploy poll uses `127.0.0.1`, so no firewall change is
   needed either way.
2. **The systemd unit is not written yet**, so there is nothing to install. When
   it is added it must stay documentation-only: installing it is a manual,
   opt-in step, and the workflow must keep using `nohup` until the user says
   otherwise.

No secret names, VPS paths, or GitHub configuration were changed.

---

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
