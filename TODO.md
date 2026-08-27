# TODO — EcoTrack

Backlog of ideas, captured from conversation. **Nothing here is implemented yet**
unless its status says otherwise.

## How to use this file

- **Never delete or cross out an item.** Mark it `[DONE]` and leave the text intact.
- Items keep their ID forever, so they can be referenced in conversation
  ("do TODO-07").
- New ideas get appended with the next free ID.

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

### TODO-19 `[ ]` Mobile enrollment screens
Replace the mobile password login with the same flow the web now has: one
button + full name → six-digit code → waiting/polling → *"Sunteți înregistrat
cu rol de X"*. The backend contract is settled and tested; `mobile/` is still
untouched and still posts to the deleted `/api/auth/login`, so **the mobile app
cannot log in at all until this is done**.

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

## Appendix — current state (context)

- **Backend:** enrollment/device-approval auth is complete and tested; passwords
  and Google sign-in are fully removed; `enforce` defaults to `true`; refresh
  tokens last 365 days and rotate on use. Full suite: 222 tests, 0 failing.
- **Web:** untouched apart from mock-mode auto-login as ADMIN. Still shows the
  old password/Google login screen in live builds.
- **Mobile:** untouched — still password login, no enrollment screens.
- **Deploy:** `deploy.yml` (backend + web to VPS, one domain via Caddy) and
  `deploy-mobile.yml` (EAS OTA + builds). See `DEPLOYMENT.md`.
- **No users and no server exist yet**, so nothing here needs a migration path.
