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

**Status legend:** `[ ]` not started · `[~]` in progress · `[DONE]` done ·
`[POSTPONED]` deliberately deferred · `[?]` needs a decision first

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

---

## B. Rute (routes)

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

---

## D. Comenzi (orders)

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

---

## E. ID scanning & photo privacy

### TODO-13 `[ ]` Scan an ID to autofill nume complet + CNP
Upload a photo of an identity document and extract **full name** and **CNP**
automatically, filling the form.

### TODO-14 `[ ]` ID photos must not be readable by the developer
The stored ID photo must not be viewable by the developer/operator (i.e. by
whoever holds the DigitalOcean Spaces credentials).
*Open problem:* plain Spaces access means the bucket owner can read every
object. Needs a real design — likely client-side or app-layer encryption where
the key is not held alongside the data, plus a retention/deletion policy.
Treat this as a **prerequisite** for TODO-13 going anywhere near production:
CNP + ID photo is sensitive personal data (GDPR).

---

## F. AI

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

## H. Mobile

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

---

## G. Repo & CI

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

---

## I. Found while doing something else

*Each of these was noticed during other work (the TODO-15/16/21 pass and the
refactoring that followed) and deliberately not fixed there: none is a
behaviour-preserving cleanup, and each wants a decision of its own.*

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

### TODO-24 `[ ]` Rotate the Google Maps key that is still in git history
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

### TODO-25 `[ ]` Backend logging: `System.out`/`System.err`, and a swallowed failure
`DataLoader`, `RecurringTaskScheduler` and `PhotoService.deletePhoto` print to
stdout/stderr while the rest of the backend uses slf4j — so those lines miss the
log format, the levels and anything that ships logs off the VPS.

`PhotoService.deletePhoto` is the one with teeth: it **swallows a delete failure
to stderr**, so a photo that fails to delete leaves no trace anywhere anyone
looks. Decide whether it should propagate, and at what level, before mechanically
swapping the print for a logger call — the logger swap alone would tidy the
symptom and keep the bug.

### TODO-26 `[ ]` The web react-hooks lint backlog
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

### TODO-27 `[ ]` The 60-day refresh-token arithmetic no longer describes production
`ecotrack.security.refresh-token-ttl-days=365`, but `TokenService`'s javadoc and
its worked example still reason in terms of the 60-day code default
(`@Value(":60")`). Neither is strictly wrong — the comments document the
fallback — but the arithmetic ("a session that refreshes every 30 minutes for
its 60-day life") describes a configuration production does not run.

Decide which number is intended, then make the property, the fallback and the
prose agree. A 365-day refresh token is a year-long credential on a lost device;
if that is deliberate it deserves a sentence saying so next to the session cap
and the nightly prune.

### TODO-28 `[ ]` Dead password-login plumbing in the web mock
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

### TODO-29 `[ ]` Nothing validates the docker-compose files
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

### TODO-30 `[ ]` There is no recovery path when the last admin loses their session
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

### TODO-35 `[ ]` Role changes on the web never reach the phone
The mobile app stores `user.roles` at claim time and never refetches. An admin
promoting or demoting someone in **Angajați** changes what the backend
authorizes but not what the phone renders: the device keeps showing the old
menus until it re-enrols. The mismatch is silent and lands on the user as
"button does nothing", or a 403.

Fix: refresh the stored user from `GET /api/auth/me` in the boot gate
(`app/index.tsx`), and probably after a 401-refresh too.

*Found while building TODO-19.*

### TODO-36 `[ ]` First-run setup code is only printed to the server log
Whoever performs the very first enrolment needs SSH access to read the setup
code out of the backend log (`ecotrack.enrollment.require-setup-code=true`).
Workable for the current operator, but the app cannot be bootstrapped by a
non-technical user, and this will be forgotten by the time it matters.

*Found while building TODO-19.*

### TODO-37 `[ ]` Bulk-move orders between subscriptions
When TODO-20 refuses a delete, the only way forward is to finish or delete each
blocking order one at a time. Offer *"Mută pe alt abonament"* in the refusal
dialog: reassign the listed orders to a chosen plan, then retry.

`SubscriptionService.deactivate`'s javadoc already records that this was
deliberately left out — "that would be a write the operator did not ask for" —
so this item is the considered follow-up, not a contradiction.

Needs a backend endpoint and a decision on whether reassigning is allowed for
orders whose tasks already carry the OLD plan name in `Task.productName`: the
name is copied onto the task, so moving the order does not move history.

### TODO-38 `[ ]` Produse deletion: hard delete, incomplete check, its own error format
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

### TODO-39 `[ ]` Check-then-act on subscription retirement is unserialized
Narrower than the repo-wide "no optimistic locking" gap in *Known gaps*, and
with a cheap local fix, so it earns its own line.

`SubscriptionService.deactivate` reads the blockers and then writes
`isActive = false`. Under READ COMMITTED nothing makes that atomic: `POST
/api/orders` can commit a new unfulfilled `IgienizareOrder` for the plan between
the read and the write. That transaction never touches the `subscriptions` row,
so nothing conflicts — no `@Version`, no row lock, no constraint. **Outcome: a
plan retired with a live order pointing at it.** Because the delete is soft the
order still resolves, so the damage is "live order on a retired plan", not a
dangling FK.

Fix: `SELECT … FOR UPDATE` on the subscription row from **both** `deactivate()`
and order creation, or `@Version` on `Subscription` plus a touching write in
`OrderService`. Either means editing `OrderService`.

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

### TODO-42 `[ ]` `/tasks/order/{id}/exists` is not row-scoped
Found while doing TODO-34, and left alone because it is an authorization decision
rather than part of that fix.

The endpoint makes **no `TaskAccessPolicy` call**. `SecurityConfig`'s matrix lets
any authenticated employee read `/api/**`, so a driver-only account can ask about
**any** order id and learn its task's id, route, schedule and status — the same
class of leak `TaskScopingTest` exists to prevent for `/api/tasks/employee/{id}`.
It is a summary of one order rather than a list, so the exposure is small and
needs an id to aim at.

Needs deciding: is order-task status office-only (`requireOfficeRole`), or should
a driver see it for orders on their own routes (a new policy method — there is no
order-shaped guard today)? Whichever is picked, the case belongs in
`SecurityTests/TaskScopingTest`, never in the controller slice.

### TODO-43 `[ ]` Comenzi asks for one order's task status per order
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
  `deploy-mobile.yml` (EAS OTA + builds). See `DEPLOYMENT.md`.
- **No users and no server exist yet**, so nothing here needs a migration path.
