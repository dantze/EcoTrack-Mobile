# Handoff — web UI/UX pass

Branch `chore/monorepo`. Everything below is uncommitted in the working tree.
Scope was **`web/src/**` only**. Nothing under `backend/`, `mobile/`,
`.github/`, `web/package.json`, `web/vite.config.ts` or `web/tsconfig*.json`
was touched, and `web/src/auth/**` + `web/src/api/live/http.ts` were left alone
(another agent owns those).

**Zero new npm dependencies were added.** Everything is built on React 19,
Tailwind 4, TanStack Query, React Router 7 and @dnd-kit, which were already
installed.

---

## 1. Verification — run these first

```bash
cd web
npm run typecheck   # PASSES (no output beyond the npm notice)
npm run build       # PASSES — dist built, only the pre-existing >500 kB chunk warning
npm run test:run    # PASSES — 10 files, 216 tests
```

Real output at handoff time:

```
Test Files  10 passed (10)
     Tests  216 passed (216)
```

`npm run dev` (mock data mode, the default) serves on http://localhost:5173.
I could **not** open a browser in this session — the Claude-in-Chrome extension
was not connected — so **none of this has been visually confirmed in a real
browser.** It typechecks, builds, and the pure logic + the Autocomplete widget
are covered by tests, but a human should click through the four screens before
this is considered done. That is the single biggest caveat in this document.

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

## 4. In progress

**Nothing is half-built.** Every file compiles, the build succeeds and the whole
suite passes. There is no fragment left mid-edit.

The one honest gap is **visual verification**: no browser was available, so the
new UI (palette modal, help overlay, suggestion cards, autocomplete popups,
the chord hint) has never been rendered on screen. The most likely problems are
cosmetic and cheap to fix:

- The dispatch suggestion panel sits in the 24 rem-wide route column. It already
  uses `layout="stacked"` on `SuggestionCard` for that reason, but the candidate
  list may still feel cramped — check it first.
- Popup z-indices were chosen to stack (`Select` 60, `Modal`/`Drawer` 50/70,
  `Autocomplete` 80, chord hint 80). Verify an Autocomplete popup inside the
  order drawer actually paints above the drawer.

---

## 5. Not started — suggested order for the next session

1. **Click through all four screens in a browser** (`cd web && npm run dev`,
   mock mode). This is the prerequisite for everything else.
2. **`AssignRecurringModal` and `EmployeeFormModal`** never got the
   keyboard/typeahead treatment that `pickers.tsx` and `ClientPicker` did.
   `web/src/features/technical/components/AssignRecurringModal.tsx` is the more
   valuable of the two.
3. **`RecurringPage` and `DriversPage`** got no deep links, no page shortcuts and
   no palette entries. Adding them is mechanical — copy the `useDeepLink` +
   `useShortcuts` block from `TasksPage.tsx`.
4. **Product selection in the order form is still a plain `Select`.** With 15
   seeded products that is fine; past ~50 it wants the `Autocomplete`, and a
   "products this client usually orders" group would fall straight out of
   `suggestions.ts` (`weightedMode` is already there and already exported-adjacent).
5. **A proper accessibility pass.** New widgets were built with roles,
   `aria-activedescendant` and focus management, but nothing was run through a
   screen reader or an axe audit, and the pre-existing screens were not audited.
6. **Ridicare edit-mode address field** still uses the plain `TextInput` — it was
   left out because pickup addresses come from the packet group, not free text,
   but it could take `suggestions` for consistency.
7. **Code-splitting.** The bundle is 629 kB (193 kB gzip) and Vite warns. Would
   need `vite.config.ts`, which was out of scope this session.

---

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
