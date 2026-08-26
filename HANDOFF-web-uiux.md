# Handoff — web UI/UX pass

Branch `chore/monorepo`. Everything below is uncommitted in the working tree.

The **first** pass was scoped to `web/src/**` only. The **second** pass (§4) also
touched `web/vite.config.ts`, for the code-splitting work — that was the one
file the original scope excluded that item (7) could not be done without.
`web/src/auth/**` and `web/src/api/live/http.ts` are still untouched here; the
auth session owns those, see `HANDOFF-auth-security.md`.

**Zero new npm dependencies were added, in either pass.** Everything is built on
React 19, Tailwind 4, TanStack Query, React Router 7 and @dnd-kit, which were
already installed.

---

## 1. Verification — run these first

```bash
cd web
npm run typecheck   # PASSES
npm run lint        # PASSES — 0 errors, 71 warnings
npm run build       # PASSES — no chunk-size warning any more (see §7)
npm run test:run    # PASSES — 10 files, 216 tests
```

`npm run dev` (mock data mode, the default) serves on http://localhost:5173.

**No browser was available in either session** — Claude-in-Chrome was not
connected the first time and was declined the second — so **none of this UI has
ever been rendered on a screen.** It typechecks, lints, builds, and the pure
logic plus the Autocomplete widget are covered by 216 tests, but a human still
has to click through the screens before any of it is considered done. **That is
the single biggest caveat in this document, and it is now two sessions old.**

`snyk` is **not installed** on this machine (`which snyk` → not found), so the
scan required by `.github/instructions/snyk_rules.instructions.md` was skipped.
Nothing added here does I/O beyond the existing `@/api` layer; the only new
persistence is `localStorage`, and every read/write is inside `try/catch` with
shape validation (`web/src/lib/recents.ts`).

---

## 2. Contract changes

**None.** No method was added to `EcoTrackApi`, so `src/api/live/` and
`src/mocks/` are still in sync by construction and mock/live substitutability
is untouched. Every "smart" feature is local computation over data the existing
contract already returns (`orders.list`, `orders.listForClient`, `tasks.list`,
`routes.list`, `clients.list`).

Two **optional** parameters were added to existing hooks (backwards compatible,
query keys unchanged):

- `useClients({ enabled })`, `useOrders({ enabled })` — `web/src/features/sales/queries.ts`
- `useRoutes({ enabled })`, `useTasks({ enabled })` — `web/src/features/technical/queries.ts`

They exist so the command palette, which lives in the shell above both feature
modules, can subscribe to the same query keys **without firing a request a
Sales-only account is not allowed to make**. Do not remove the `enabled` gate
without re-checking the role logic in `CommandPalette.tsx`.

Two new mutations, both in `web/src/features/technical/queries.ts`, both
composed from existing contract methods:

- `useAssignTasksToRoute(routeId)` — `tasks.reassignMany` then
  `routes.reorderTasks`. Two calls because the contract has no "assign at
  position"; same pattern as the existing `useMoveTaskToRoute`.
- `useUpdateManyTaskStatuses()` — fans out `tasks.updateStatus` **sequentially**
  and returns `{ updated, failed }`. Sequential on purpose: the backend has no
  optimistic locking (see CLAUDE.md "Known gaps"), and twenty concurrent writes
  is the wrong way to discover that.

---

## 3. Done

### 3.1 New shared primitives (`web/src/lib/`)

| File | What it is |
|---|---|
| `web/src/lib/search.ts` | Diacritic-insensitive folding, fuzzy multi-term scoring, ranking, highlight ranges |
| `web/src/lib/recents.ts` | Per-browser usage log (localStorage) used as a ranking bonus |
| `web/src/lib/hotkeys.tsx` | Shortcut registry, provider, chord handling |
| `web/src/lib/deepLink.ts` | Query-string intents (`?comanda=42`, `?nou=1`) |

**Why `search.ts` has two folds — this is the non-obvious bit.** `fold()` is the
cheap one. `foldAligned()` emits **exactly one character per input character**
so that an index into the folded string is also an index into the *original*.
Highlight ranges are computed on the folded string and applied to the original
("Ștefan" typed as "stefan" must underline `Ștefan`, not `Ștefa`). If anyone
"simplifies" `foldAligned` to `value.normalize('NFD').replace(...)`, the length
changes and every highlight in the app silently shifts. There is a test that
pins this (`web/src/lib/__tests__/search.test.ts`, "preserves length").

**Why `recents.ts` bounds its boost.** Score is frequency × exponential recency
decay (14-day half-life), passed through `log1p` and **capped at
`BOOST_CEILING = 260`**. The cap matters: an exact-name match scores ~1200, so a
stale favourite can nudge an ambiguous two-letter query but can never outrank
someone typing a full name. Everything is wrapped in `try/catch` — a private
window or a disabled site-data setting costs the ranking bonus and nothing else.

**Why `hotkeys.tsx` blocks bare keys in two situations.** While focus is in an
`input`/`textarea`/`select`/contenteditable, and while any
`[role="dialog"][aria-modal="true"]` is in the DOM, only `mod+…` combos fire. A
dispatcher typing "Ana" must not trigger `n = new order` on the second letter,
and pressing `n` inside an open order drawer must not open a second drawer
behind it. `⌘K` deliberately still passes through both guards so the palette can
be toggled from anywhere.

### 3.2 Command palette — ⌘K / Ctrl+K, every screen

`web/src/features/command/CommandPalette.tsx`, mounted from
`web/src/components/layout/AppShell.tsx`.

Searches clients, orders, tasks, routes, the nav destinations, and three
creation actions. Ranked by `lib/search` relevance **plus** the `lib/recents`
bonus. With an empty query it shows recently opened records first, then the
actions. Role-aware: a SALES-only account never sees Tehnic entries and the
queries behind them stay disabled.

Picking a row navigates to a **deep link**, which is why the pages below learned
to read query params — and a useful side effect is that every record now has a
shareable URL.

| URL | Effect |
|---|---|
| `/comenzi?comanda=<id>` | opens that order's detail drawer |
| `/comenzi?nou=1` | opens an empty order form |
| `/clienti?client=<id>` | opens that client's drawer |
| `/clienti?nou=1` | opens an empty client form |
| `/sarcini?sarcina=<id>` | opens that task's drawer |
| `/rute?ruta=<id>` | selects that route (and clears the date filter, since a linked route is rarely on today) |
| `/rute?nou=1` | opens the route form |
| `/recurente?plan=<id>` | opens that plan's drawer (added in the second pass, §4) |
| `/soferi?sofer=<id>` | opens that driver's drawer (added in the second pass, §4) |
| `/soferi?nou=1` | opens an empty employee form (added in the second pass, §4) |

Consumed params are cleared with `replace: true` so Back does not walk the user
through re-opened drawers.

### 3.3 Keyboard shortcuts + discoverable help

`web/src/lib/hotkeys.tsx`, `web/src/features/command/ShortcutHelp.tsx`,
registrations in `AppShell.tsx` and the four screens.

- Global: `⌘K`/`Ctrl+K` palette, `?` help overlay, `g` then `c l p a r s d i`
  to jump to a section (a toast-style hint shows the pending chord).
- Comenzi / Clienți: `n` new, `/` focus search, `r` refresh.
- Sarcini: `/` focus search, `t` today, `a` all dates, `r` refresh.
- Rute: `n` new route, `/` focus search, `t` today, `a` all dates, `d` driver picker.

The help overlay renders the **live registry**, not a hand-written list, so a
screen that registers a key shows up automatically and the list can never go
stale. The sidebar has a "Scurtături tastatură · ?" link and a "Caută… ⌘K"
button so neither is hidden.

### 3.4 Typeahead / autocomplete

**New primitive:** `web/src/components/ui/Autocomplete.tsx`, exported from the
UI barrel. An *editable* combobox (unlike `Select`, which is a listbox and
constrains the value): what you type is the value, the list only offers
shortcuts. Full ARIA combobox, ↑ ↓ / Enter / Escape / Tab, portalled popup so a
drawer's `overflow:auto` cannot clip it, matched characters highlighted.

Escape inside it **stops propagation** so closing the suggestion list does not
also close the drawer the field lives in. There is a test for that.

Applied to:

- **Address fields in the order form** — `web/src/features/sales/components/fields.tsx`
  (`LocationFields` gained optional `suggestions` + `coordinatesFor`). Accepting
  a suggestion also fills the `"lat,lng"` coordinates from the order it came
  from. Falls back to a plain `TextInput` when no `suggestions` prop is passed,
  so existing call sites are unaffected.
- **Client picker** — `web/src/features/sales/components/ClientPicker.tsx`,
  rewritten: ranked + recency-boosted + keyboard-navigable listbox with
  `aria-activedescendant`, focus never leaves the search box.
- **Route and driver pickers** — `web/src/features/technical/components/pickers.tsx`:
  `data-autofocus` so the cursor lands in the filter on open, ↑ ↓ / Enter, real
  `listbox`/`option` semantics, and routes ordered by recent use when unfiltered.

**Diacritic-insensitivity was a real pre-existing bug, now fixed** in every
search box: `OrdersPage`, `ClientsPage` (via `matchesClient`), `ProductsPage`,
`SubscriptionsPage`. They all used plain `.toLowerCase().includes()`, so typing
`stefan` found nothing for `Ștefan` and `bucuresti` found nothing for
`București`. The Technical module already normalised correctly
(`features/technical/utils.ts`) and was left as-is.

### 3.5 "Smart" assistance — Sales (`web/src/features/sales/suggestions.ts`)

All deterministic, all local, all opt-in. Rendered through
`web/src/components/ui/SuggestionCard.tsx` (moved there from the sales module
because the dispatch board reuses it), which enforces the pattern: say what it
will change *before* it changes anything, show where it came from, one click to
accept, one click to ignore. **Nothing ever auto-writes.**

Wired into `web/src/features/sales/components/OrderFormDrawer.tsx`.

| Feature | Heuristic | Data read |
|---|---|---|
| **Pre-fill card** ("Completează din istoricul clientului") | Per field: recency-weighted mode for *chosen* values (product, subscription, igienizări/lună, durată), **median** for quantity, **most recent non-null** for address/coordinates/contact | `api.orders.listForClient(clientId)` (the client's own orders), plus `products.list` / `subscriptions.list` to avoid suggesting a retired catalogue entry |
| **Order-type nudge** | Recency-weighted mode over the client's order types; needs ≥2 orders. Renders as one line with a "Comută pe X" link | same |
| **Quantity anomaly warning** | Median + **MAD** over the client's placements of the same product (falls back to all placements if <3 samples). Fires only when *both* `distance > max(3·MAD, 1)` **and** the ratio to the median is ≥2. Needs ≥3 comparable orders | same |
| **Address typeahead** | Distinct addresses, client's own first (ranked by count then recency), then everyone else's, deduped diacritic-insensitively | client orders + `api.orders.list()` (already cached by OrdersPage) |

Design decisions a reviewer would not guess:

- **Recency weight is a 90-day half-life exponential, not a plain count.** A site
  that switched from standard to VIP cabins three months ago should suggest VIP,
  not the two-year run of standard before it. Tested.
- **Median, not mean, for quantity** — both for the suggestion and the anomaly
  check. A mean is dragged around by exactly the freak order we are trying to
  catch; with history `[2,2,2,50]` a mean sits near 14 and hides a repeat of the
  same typo, while the median stays at 2 and still flags it. Tested.
- **The anomaly is a `WarningNote`, never a validation error.** 30 cabins for a
  festival is a real order and must stay one click away.
- **The type nudge never preselects a type.** Being silently dropped onto the
  wrong subtype form is worse than one extra click.
- **`useClientOrders` now fetches as soon as a client is picked**, not only for
  Ridicări. One extra request; it feeds the packet groups, the pre-fill card and
  the address list.

### 3.6 "Smart" assistance — dispatch board (`web/src/features/technical/grouping.ts`)

Rendered by `web/src/features/technical/components/suggestions.tsx`, mounted in
the route panel of `web/src/features/technical/RoutesPage.tsx`.

Two proposals, both straight-line haversine geometry over `Task.coordinates`,
both showing their own numbers so a dispatcher can disagree on sight:

1. **"Grupare sugerată"** — unassigned jobs that belong on the selected route.
   Filters in order: (a) **day** — a job already scheduled for another date is
   *never* proposed, because moving a job to a different day is a decision, not
   a convenience; (b) **place** — within `NEARBY_RADIUS_KM = 25` of one of the
   route's stops. For a route with **no stops yet** it seeds from the *densest
   cluster in the pool* (the pool point with the most neighbours inside the
   radius), because an empty route is exactly when a grouping helps most and it
   has no geometry of its own to attract anything. Jobs with no coordinates fall
   back to matching locality (last comma-separated chunk of the address) or
   county. Survivors are sequenced nearest-neighbour from the route's last stop.
   **Stays silent below 2 candidates** — one nearby job is a drag-and-drop, not
   a grouping, and a panel that nags on every route gets ignored.
2. **"Ordine mai scurtă a opririlor"** — nearest-neighbour re-sequence.
   **Keeps the first stop fixed** (usually the depot or the driver's start;
   this cannot know that, so it does not touch it) and only speaks when the
   saving clears `MIN_SAVING_KM = 2`.

Accepting calls `useAssignTasksToRoute` / `useReorderRouteTasks`; dismissals are
keyed by route id **and by the shape of the proposal**, so a dismissed proposal
reappears if the board changes enough to produce a different one.

The crudeness is deliberate and documented in the file header: no routing
service, no traffic, no network. The dispatcher knows about the closed bridge;
this only knows two sites are 3 km apart. Both cards say the distances are
straight-line.

### 3.7 Bulk action

**Sarcini** (`web/src/features/technical/TasksPage.tsx`): the selection toolbar
gained a "Schimbă statusul…" dropdown that sets one status on the whole
selection via `useUpdateManyTaskStatuses`. Closing out a finished route used to
mean editing every row by hand. Reports partial failure honestly
(`{ updated, failed }`) and only clears the selection when nothing failed.

### 3.8 Tests added (all passing)

- `web/src/lib/__tests__/search.test.ts` (21)
- `web/src/lib/__tests__/recents.test.ts` (13) — includes hostile-localStorage paths
- `web/src/features/sales/__tests__/suggestions.test.ts` (20)
- `web/src/features/technical/__tests__/grouping.test.ts` (20)
- `web/src/components/ui/__tests__/Autocomplete.test.tsx` (13)

The vitest setup (`web/src/test/setup.ts`, config block in `vite.config.ts`) was
added by a **different agent** during this session — I only added test files.

---

## 4. Done in the second pass

Everything in the old §5 list except items 1, 4 and 5. Numbering below matches
that list so the two can be read side by side.

### (2) `AssignRecurringModal` — keyboard-first

Rewritten on the same pattern as `pickers.tsx`, and now literally sharing its
machinery: `useListKeyboard` and `PickerRow` were exported from `pickers.tsx`
rather than reimplemented. The filter box takes focus on open (`data-autofocus`),
↑ ↓ move a highlight, Enter assigns, and the list is a real `listbox` driven by
`aria-activedescendant`. It also gained a **search filter it never had** — it was
previously a flat list of every unassigned plan — and empty-filter ordering by
`lib/recents`, so plans for clients the operator has been working on come first.

`PickerRow` gained an optional `trailing` slot for the "Asignează" button. Two
things about it that are easy to get wrong and are commented in place:

- Its clicks are **stopped from reaching the row**, or an explicit button press
  would fire the mutation twice.
- It is `aria-hidden` and **must be `tabIndex={-1}`**. A `role="option"` may not
  contain interactive descendants, and this button only duplicates what
  activating the row already does. Keyboard users reach it via ↑ ↓ / Enter.

**`EmployeeFormModal` was left alone.** It is a plain create/edit form — name,
username, phone, county, roles — with no list to navigate and nothing to
typeahead against. The keyboard treatment `pickers.tsx` got does not apply to
it; what it would actually want is the generic form-focus work in item (5).

### (3) `RecurringPage` and `DriversPage` — deep links, shortcuts, palette

| URL | Effect |
|---|---|
| `/recurente?plan=<id>` | opens that plan's drawer |
| `/soferi?sofer=<id>` | opens that driver's drawer |
| `/soferi?nou=1` | opens an empty employee form |

Shortcuts: Recurente `/` search, `u` unassigned, `a` all, `r` refresh. Șoferi
`n` new employee, `/` search, `t` today, `r` refresh. Both register into the
live registry, so they appear in the `?` overlay automatically.

Palette gained two record kinds (`recurring`, `driver`) and one action
("Angajat nou"). `RecentKind` in `lib/recents.ts` grew the two matching kinds.

Two things worth knowing:

- **`useDrivers` and `useRecurring` gained the `enabled` option** the other four
  read hooks already had, for the same reason: the palette subscribes to them
  from the shell, and without the gate a Sales-only account fires a request it
  is not allowed to make.
- **The `?plan=` effect reads from `useRecurring('all')`, not the visible tab.**
  The default tab is "unassigned" and a linked plan is usually assigned, so
  reading the visible list would make the link a silent no-op. It waits for the
  full list before clearing the param — clearing early breaks the link on a cold
  cache — and switches the tab to "all" on success, so closing the drawer does
  not leave the operator staring at a list the plan is not in.

### (6) Ridicare edit-mode address field

Now takes `suggestions` / `coordinatesFor` like the placement and sanitation
addresses. The original reasoning for leaving it out still holds — pickup
addresses come from the packet group, not free text — but once someone *is*
editing it by hand there is no reason to withhold the typeahead. Required
threading `addressOptions` / `coordinatesForAddress` down into `RidicareFields`,
which did not take them.

### (7) Code-splitting — the chunk warning is gone

Two changes, and the numbers are real (`npm run build`):

| | before | after |
|---|---|---|
| entry chunk | 632.91 kB (194.39 kB gz) | **294.89 kB (92.55 kB gz)** |
| Vite >500 kB warning | yes | **no** |

1. **`src/routes/router.tsx`** loads the eight feature screens with React
   Router's own `lazy`. Not `React.lazy` + `Suspense`: the data router already
   has a pending state, so the current screen stays on-screen during the fetch
   instead of blanking to a spinner. Each screen becomes its own chunk, which
   matters twice over — nobody has both role sets in practice, so a dispatcher
   was downloading the whole Vânzări module to look at a route; and **@dnd-kit
   is used by exactly one screen**, so `RoutesPage` now carries it (72.6 kB) and
   nobody else pays for it.

   The auth screens stay eager on purpose: making `LoginPage` a second round
   trip puts a network hop on the critical path to the login form.

2. **`vite.config.ts` `manualChunks`** splits `react`/`react-dom`/`react-router-dom`
   (95.8 kB) and `@tanstack/react-query` (50.7 kB) into their own chunks. The
   point here is **cache lifetime, not first load**: those change only on a
   version bump, while app code changes every deploy. Left in the entry chunk,
   one CSS tweak invalidates ~140 kB of framework for every user.

   Keep react and react-dom in the same chunk — splitting them risks two copies
   of the reconciler.

**Not fixed, and worth knowing:** `src/api/index.ts` statically imports *both*
`liveApi` and `mockApi`, so a `VITE_DATA_MODE=live` build still bundles the
entire mock implementation and its seeded dataset (~2,500 lines). Fixing it
properly means making the selection dynamic, which turns `api` from a value into
a promise and breaks the "feature code imports only `{ api } from '@/api'`" rule
CLAUDE.md calls load-bearing. Not worth it while mock is the deployed default
and a live build cannot reach the backend anyway (no TLS) — but that is why the
entry chunk is still 295 kB rather than ~150 kB.

---

## 5. Still not done

### (1) Click through it in a browser — **still the prerequisite for everything**

Two sessions, no browser either time. This has never been rendered. Start here.

### (4) Product Autocomplete — **deliberately not done, and I think it is the wrong change**

The old note said "with 15 seeded products a `Select` is fine; past ~50 it wants
the `Autocomplete`". Having looked at it: past ~50 it wants *a searchable
picker*, but **not this one**.

`Autocomplete` is by design an *editable* combobox — "what you type is the
value", as §3.4 says — while product selection stores `form.productId: number`
and the order payload needs a real id. Swapping it in would let a typo produce a
valid-looking field that resolves to no product, and would need an
id-resolution layer plus new validation on top. That is a data-integrity
regression bought for a UX gain that does not apply at the current catalogue
size.

The right change when it is needed is a **constrained** searchable listbox — the
`ClientPicker` / `pickers.tsx` pattern, which filters but cannot produce a value
outside the list. That component does not exist in a generic form yet.

### (5) Accessibility pass — mostly still open

What was checkable statically was checked: a scan for icon-only controls with no
accessible name came back **clean**, because `IconButton` requires a `label:
string` and maps it to both `aria-label` and `title` — the type system makes
that class of defect unrepresentable. One real issue was found and fixed, in
code written this session (the `role="option"` / interactive-descendant problem
in `PickerRow`, above).

Everything that actually needs the browser is still open: contrast ratios, focus
order, focus-trap behaviour in nested overlays, and anything a screen reader
would tell you. An `axe-core` run in jsdom would catch a further slice and would
be a reasonable next step — it is a new devDependency, which is why it was not
added unilaterally.

Also still open from the original list: nothing else. Items 2, 3, 6 and 7 are
done above.

## 6. Gotchas

- **Two other agents were editing this same working tree concurrently.** They
  touched `web/package.json` (added vitest, eslint, testing-library),
  `web/vite.config.ts`, `web/src/components/ui/DataTable.tsx`,
  `web/src/mocks/__tests__/`, `web/src/api/live/__tests__/`,
  `web/src/features/sales/__tests__/`, `web/src/test/`, and a large amount of
  `backend/`. Mid-session `npm run typecheck` failed on **their**
  `web/src/mocks/__tests__/contract.test.ts`; they fixed it themselves and it is
  green now. If you see unfamiliar changes in those paths, they are not mine.
- **`web/src/components/ui/SuggestionCard.tsx` was moved** from
  `web/src/features/sales/components/` into the UI kit (git sees a delete + an
  untracked add). It is exported from the barrel as `SuggestionCard` and
  `WarningNote`.
- **Shortcuts are registered per-screen and unregister on unmount.** If a key
  seems dead, check whether a modal is open — the provider deliberately ignores
  bare keys while any `[role="dialog"][aria-modal="true"]` exists.
- **`?` requires Shift on most layouts** but `event.key` is `'?'` either way, so
  the combo string is just `'?'`. Do not "fix" it to `shift+/`.
- **Deep-link effects depend on the memoised `deepLink` object.** They clear
  their own param, which changes `location.search`, which is what stops them
  re-firing. Do not add the raw `searchParams` object to those dep arrays.
- **`lib/recents.ts` is per-browser and never leaves the machine.** It is a
  ranking nicety only; no feature may depend on it being present.
- **The mock dataset only has 40 clients / 120 orders / 150 tasks.** Several
  heuristics need history to say anything (≥2 orders for the type nudge, ≥3 for
  the anomaly check), so some clients will legitimately show no suggestion card.
  That is correct behaviour, not a bug.
- **`snyk` is not installed**, so the repo-wide scan instruction was not
  satisfied. Run it before merging.

### Gotchas added by the second pass

- **`PickerRow`'s `trailing` slot is `aria-hidden` and its content must be
  `tabIndex={-1}`.** It sits inside a `role="option"`, which may not contain
  interactive descendants. Dropping either half reintroduces the violation.
- **`useListKeyboard` and `PickerRow` are now exported from `pickers.tsx`** and
  used by `AssignRecurringModal`. Changing their behaviour changes three
  screens, not one.
- **The `?plan=` deep link waits for `useRecurring('all')` before clearing its
  param.** Clearing on the first render makes the link a no-op on a cold cache.
- **React Router `lazy` route objects return `{ Component }`, not an element.**
  The `lazyPage` helper in `router.tsx` does that mapping; adding a screen means
  adding a `lazy:` entry, not an `element:`.
- **`manualChunks` keeps react and react-dom together deliberately.** Splitting
  them can load two copies of the reconciler.
- **The new deep-link effects produce `set-state-in-effect` warnings**, exactly
  like the existing ones on `TasksPage`/`RoutesPage`/`OrdersPage`. That rule is
  one of the React-Compiler diagnostics deliberately downgraded to a warning
  (see `HANDOFF-ci-tests-deploy.md` §1). Lint count went 66 → 71; all five new
  warnings are that rule, on the pattern the codebase already uses.
