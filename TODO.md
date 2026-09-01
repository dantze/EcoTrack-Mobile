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

### TODO-12 `[ ]` Calendar view next to Comenzi
A big calendar laid out like an advent calendar ("Christmas sweets" style):
- Each day cell shows a summary of that day's information underneath the date.
- Clicking a day opens all orders for that day.
*Blocked on:* OQ-1 — needs the order/task distinction settled first.

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

**Done. Retiring a plan is refused while an unfulfilled order references it.**
`SubscriptionService.deactivate` is now `@Transactional` and throws
`ResourceInUseException` (new, extends `IllegalStateException`, which
`GlobalExceptionHandler` already maps to **409**) carrying a `blockingOrders[]`
list of `BlockingOrderRef`. **No second error mechanism was introduced** — the
new handler is just more specific, and if it were deleted the status would still
be 409. Romanian message, singular/plural correct, byte-identical between
backend and mock.

**"In use" = not fulfilled**, decided as briefed: fulfilled orders keep
resolving through TODO-11's soft-delete flag exactly as before, and blocking on
them would make any long-lived plan permanently undeletable.

**The rule agrees with TODO-21 branch for branch** — and better than by
coincidence: the new `service/OrderFulfilmentPolicy.java` is the backend's
single answer to "is this order finished?", and **the web mock imports
`web/src/lib/orderLifecycle.ts` directly rather than hand-rolling a twin**, so
the archive filter and the delete refusal call one definition. Backend-only
`CANCELLED` collapses to the same outcome as the web summarizer's `NEW`. The two
files are a deliberate mirror pair and must move together.

Only `IgienizareOrder` references a `Subscription`, so the Amplasare branch of
the policy never fires here; it exists because the policy is the general rule.

**UI is a dialog, not a toast.** A refusal is a list of work to finish, and a
toast that vanishes in six seconds cannot be acted on — the modal shows the
backend's own sentence plus a table of blockers (`#number`, type, client, date).
New `web/src/api/errors.ts` holds `SubscriptionInUseError`, thrown by **both**
implementations, because `ApiError`/`MockApiError` each pin a screen to one data
mode.

No `SecurityConfig` or `TaskAccessPolicy` change: path and verb are unchanged
and `DELETE /api/**` → OFFICE already covered it.

Backend **240 tests** (was 222), 0 failures. Web typecheck clean, **326 tests**,
build OK, bundle 139.5 kB / 160 kB.

### TODO-27 `[ ]` Bulk-move orders between subscriptions
When TODO-20 refuses a delete, the only way forward is to finish or delete each
blocking order one at a time. Offer *"Mută pe alt abonament"* in the refusal
dialog: reassign the listed orders to a chosen plan, then retry the delete.

Needs a backend endpoint (`PATCH /api/subscriptions/{id}/orders` or similar) and
a decision on whether reassigning is allowed for orders that already have tasks
carrying the OLD plan name in `Task.productName` — the name is copied onto the
task, so moving the order does not move history.

*Deliberately excluded from TODO-20, which answered "refuse and list".*

### TODO-28 `[ ]` Produse deletion: hard delete, incomplete check, its own error format
Investigated under TODO-20 and found **materially different from Abonamente**,
so it was deliberately NOT given the same fix — applying TODO-20's rule here
would be a regression. Three separate problems in `ProductService.deleteProduct`
/ `ProductController.deleteProduct`:

- **(a)** `existsByAmplasareOrderProductId` only checks `AmplasareOrder.product`.
  **`RidicareOrder.product` is never checked**, so a product used only by
  Ridicări can be destroyed today, leaving a dangling FK. *Small fix, real bug.*
- **(b)** It is a **hard** delete (`productRepository.deleteById`), not a soft
  one. That is why its strict "any referencing order blocks" rule is *correct*
  and must not be relaxed to TODO-20's "only unfulfilled orders block" —
  destroying a product that fulfilled orders still reference is exactly the
  dangling reference the subscription flag exists to prevent. Adopting the
  friendlier rule requires giving Produse an `isActive` soft-delete flag first.
  **This is the real decision, not a cleanup.**
- **(c)** `ProductController` catches `IllegalStateException` itself and returns
  `409 {"error": …}`, bypassing `GlobalExceptionHandler`. It is the only place
  in the app where the error body's message lives under `error` rather than
  `message`, and it carries no blocker list. *Small fix.*

### TODO-29 `[ ]` An active recurring plan does not block retiring its subscription
`RecurringIgienizare.subscription` is a **second** reference to a subscription
that TODO-20's rule does not cover, and the gap is not theoretical:
`RecurringIgienizareService` creates one `IgienizareOrder` up front and
thereafter generates **tasks** linked to the plan, not to that order. So the
plan's initial order has zero tasks, falls through to date reasoning, and a
long-running indefinite plan **reads as fulfilled within a day of its start
date** and stops blocking — while `RecurringTaskScheduler` keeps minting tasks
stamped with the retired plan's name every night at 02:00.

Decide whether an `active` recurring plan joins the blocker set, and how it
should appear in a list whose type says "orders".

*Found while building TODO-20.*

### TODO-30 `[ ]` Check-then-act on subscription retirement is unserialized
Narrower than the repo-wide "no optimistic locking" gap in *Known gaps*, and
with a cheap local fix, so it is worth its own line.

`deactivate` being `@Transactional` only makes the blocker query and the
`isActive` write commit together. Under READ COMMITTED nothing makes
check-then-act atomic: `POST /api/orders` can commit a new unfulfilled
`IgienizareOrder` for the plan between the `SELECT` and the `COMMIT`. That
transaction never touches the `subscriptions` row, so nothing conflicts — no
`@Version`, no row lock, no constraint. **Outcome: a plan retired with exactly
one live order pointing at it.** Because the delete is soft that order still
resolves, so the damage is "live order on a retired plan", not a dangling FK.

Fix: `SELECT … FOR UPDATE` on the subscription row taken by **both**
`deactivate()` and order creation, or `@Version` on `Subscription` plus a
touching write in `OrderService`. Either means editing `OrderService`.


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

*Related:* OQ-1 — archiving depends on knowing when an order is finished, which
depends on the order/task relationship being clear.

**Done, derived not stored.** Archived ⇔ lifecycle `'done'`, so there is no new
state to keep in sync and no un-archive button — an order leaves the archive
when its tasks change. Comenzi gained a **Curente / Arhivă / Toate** tab strip.

**The derivation moved to `web/src/lib/orderLifecycle.ts`** — it was never
map-specific. `features/map/data.ts` now imports it instead of owning it, and
`features/map/types.ts` re-exports `Lifecycle`/`LIFECYCLES`/`LIFECYCLE_LABEL`
from lib so no map import changed (`LIFECYCLE_COLOR` stayed — map-specific hex).
`orderPrimaryDate` came down from `sales/orderModel.ts` too, re-exported under
its old name, because the derivation reasons about the same date anchor.
`src/lib/` was chosen because its files only ever import `@/types/domain` and
`@/components/ui`, so the dependency arrow keeps pointing one way — a feature
importing another feature is what this avoids.

**Two entry points, one rule:** `deriveLifecycle(order, taskStatus, today)`
takes an already-summarized status; `deriveLifecycleFromTasks(order, tasks,
today)` wraps it. Both exist because Comenzi only has one status per order while
the map has full task lists. **A test asserts the two agree on every task
combination**, which is the guard against the exact drift TODO-21 warned about.

**The fulfilled rule, for reconciliation with TODO-20:**
1. *Task evidence first.* Every task `COMPLETED` → fulfilled. Any `IN_PROGRESS`
   → not. Otherwise (all `NEW`, or `NEW`+`COMPLETED` mixed) with an anchor date
   before today → not, it is overdue. Else fall through to dates.
2. *Dates*, also used when an order has no tasks. **Amplasari:** not fulfilled
   without a `startDate`, before `startDate`, while `isIndefinite`, or while
   `today <= endDate`; fulfilled once past `endDate`. **Ridicari/Igienizari:**
   fulfilled iff `date < today` strictly — a visit dated today is being worked.
3. Anything undecidable is **not** fulfilled.

**Read-only is a property of the VIEW, not the record.** In Arhivă there is no
checkbox column, no bulk-delete bar and no Editează/Șterge in the drawer; in
Toate the same order keeps both. Deliberate: archiving is derived from task data
that can itself be wrong, so there must be one place to correct a mis-archived
order. The absence of un-archive is stated in Romanian UI copy in two places
rather than left to be discovered.

**Nothing archives while task statuses are still loading.** The status fan-out
lands after the list; hiding live work on incomplete evidence is worse than
showing a finished order a second longer, and it stops rows flickering between
tabs.

Client-side filtering only — `api.orders.list()` is unpaginated and `useOrders`
already holds the whole list, so `src/api/**` and `queries.ts` were not touched
at all. Web: typecheck clean, **323 tests** (16 new), build OK, bundle
139.5 kB / 160 kB. The map's 53 existing lifecycle tests pass unchanged against
the moved function — the proof this was a move and not a rewrite.

### TODO-23 `[ ]` `/tasks/order/{id}/exists` returns one task, not a roll-up
`GET /api/tasks/order/{orderId}/exists` returns
`getTaskByOrderId(...).orElse(null)` — a **single** task. But
`summarizeTaskStatus` in `web/src/lib/orderLifecycle.ts` and the backend's
`OrderFulfilmentPolicy` both roll up **all** of an order's tasks.

Today orders appear to produce one task each, so the answers coincide and
nothing is visibly broken. **Nothing enforces that.** An order with two tasks
would be archived by Comenzi (TODO-21) off whichever row the backend happens to
return first, while the map and the subscription delete-guard (TODO-20) compute
the real roll-up and disagree — three views of one order, two definitions.

Fix either by making `/exists` return the summarized status, or by adding a
batch endpoint (`GET /api/tasks/order-status?ids=…` → summarized status per
order), which would also collapse the current one-request-per-order fan-out on
Comenzi. Noted inline in `OrdersPage.tsx`.

*Found while building TODO-21.* Shares its definition with TODO-20 and TODO-21 —
see the note on those.


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

**Done.** Twelve files deleted and the `service/intake/` package removed:
`IntakeConfig`, `IntakeMessage`, `OrderDraft`, `IntakeMessageRepository`,
`OrderDraftRepository`, and all of `service/intake/**` (`DraftResolver`,
`ExtractedOrder`, `HeuristicOrderDraftExtractor`, `IntakeService`,
`MistralOrderDraftExtractor`, `OrderDraftExtractor`, `RomanianDates`).

`RomanianDates` was checked before deleting — its only callers were the four
intake classes going with it, so it went too. It was the one file that could
plausibly have been a general-purpose utility.

**The removal turned out to be fully self-contained**, which is worth recording
because it means there is no residue to hunt later: intake never had a
controller (so no `SecurityConfig` matrix row and no security test referenced
it), never had a single test class, had no committed config — the
`ecotrack.intake.mistral.*` keys were env-var-driven with no defaults in any
`application*.properties`, `.env.example`, `docker-compose*.yml` or workflow —
and no `web/` or `mobile/` code called it. No Gradle dependency was removed
either: `MistralOrderDraftExtractor` used `RestClient` from the shared
`spring-boot-starter-web`.

Backend suite still 222 tests, 0 failures (the count is unchanged precisely
because none of them covered this code).

### TODO-16 `[DONE]` Remove recommended additions to routes
The "recommended additions" suggestions on routes are not wanted. Remove them.

**Done, client-side only.** `technical/components/suggestions.tsx` (the
`DispatchSuggestions` panel) is deleted and its block is out of `RoutesPage`.
`grouping.ts` lost `suggestRouteGroup`, `suggestStopOrder` and every helper that
existed only to feed them — `weekdayOf`, `fallsOnAnotherDay`, `densestSeed`,
`pointOf`, `pathLengthKm`, `localityOf`, `orderByProximity`, the
`GroupCandidate`/`GroupSuggestion`/`ReorderSuggestion` types and the
`NEARBY_RADIUS_KM`/`MIN_SAVING_KM` constants.

**Three things were deliberately KEPT** — each looks like part of the feature
and is not:
- `distanceKm` (and `EARTH_RADIUS_KM`) in `grouping.ts`: `features/map/data.ts`
  imports it for its own route-length estimate. Its tests stayed too.
- `components/ui/SuggestionCard.tsx` and its `ui/index.tsx` export: shared with
  `sales/components/OrderFormDrawer.tsx` (the order autofill suggestion), which
  is a different feature. Only the routes usage went.
- `useAssignTasksToRoute` in `queries.ts`: also drives the held-tray multi-select
  placement gesture and two button-disabled states, so it was never
  suggestion-only. Its doc-comment, which claimed it existed to "accept a
  suggested group", was corrected.

**No backend or data-layer change.** The heuristics were pure client-side
geometry over data already on the board; applying a suggestion just called the
generic `api.tasks.reassignMany` / `api.routes.reorderTasks` that drag-and-drop
already uses. Nothing in the contract, `src/api/live/` or `src/mocks/` moved, so
the live/mock substitutability rule was never in play.

Web: typecheck clean, 307 tests passing, build OK, bundle budget 138.8 kB of
160 kB initial gzip.

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

**Done. The mobile app can authenticate again.** New `app/enrollment.tsx`
(form → waiting → done), `services/EnrollmentService.ts`,
`services/enrollmentStorage.ts` and `services/roleRouting.ts`.
`app/login.tsx`, `AuthService.login` and its `LoginResponse` type are deleted —
they were the only callers of the removed `POST /api/auth/login`.

**The backend contract it was written against** (read from the backend, not
assumed from the web app):

| Endpoint | Method | Response |
|---|---|---|
| `/api/enrollment/status` | GET | `{awaitingBootstrap, setupCodeRequired}` |
| `/api/enrollment/request` | POST | 200 `{requestId, claimSecret, verificationCode, expiresAt, autoApproved}` · 400 bad input · 403 bad setup code · 429 rate-limited (5/device/hour) |
| `/api/enrollment/claim` | POST | 200 `LoginResponse` · **202 pending** · 403 rejected · 410 expired/spent · 404 unknown-or-wrong-secret |

Request TTL 10 min, then 10 min to claim after approval
(`ecotrack.enrollment.*`). First-user-becomes-admin needs no separate path: the
screen still enters the waiting phase, but `autoApproved` means its first poll
issues tokens immediately.

**The trap worth remembering:** `BearerTokenAuthenticationFilter` 401s *any*
request carrying a token it cannot validate, and it runs BEFORE authorization —
so it fires on the `permitAll` enrollment endpoints too. A device whose session
was revoked still holds that dead token, so a plain `apiFetch` would have made
the one screen that can recover the device the one screen it cannot reach.
`apiFetch` gained an `{ anonymous: true }` option; all three enrollment calls
use it and a test asserts it. **No backend change was needed** — this is a
client-side rule about which calls may carry a token.

**`app/index.tsx` was an unconditional redirect to `/login`** and had to become
a real boot gate. Not polish: under enrollment, "go to the login screen on every
launch" means filing a fresh access request — needing a human admin — every time
the app restarts. For the same reason the Driver back gesture now goes to `/`
rather than `/enrollment`.

Device id is minted once and persisted in AsyncStorage (`@ecotrack_device_id`,
single-flight so two callers cannot mint two ids); it is a self-asserted label,
not a credential. The pending ticket is persisted too, so backgrounding the app
while an admin walks over does not force a new six-digit code. Polling stops on
approval, rejection, expiry, countdown zero, *Anulează* and unmount; a 5xx is
swallowed so a network blip does not end the wait.

Picked up on the way: the Sales and Technical menus' "logout" only changed
screens and never revoked the session — they now call `AuthService.logout()`.
`RoleSelection` gained an ADMIN card, since the first enrollee is ADMIN-only and
had no destination at all.

Mobile: lint 0 errors, typecheck clean, **83 tests** (was 59). `vitest.config.ts`
now includes `services/`, with the rule in its header that services tests must
`vi.mock` every native dep with a factory.

**Unverified, and not claimed otherwise:** nothing was exercised end-to-end —
no real request→approve→claim round trip against a running backend, no render
check on a device, and the token-adoption→first-authenticated-call handoff is
covered only by mocks. Snyk is not installed here, so the `snyk_rules` scan did
not run.

### TODO-24 `[ ]` Role changes on the web never reach the phone
The mobile app stores `user.roles` at claim time and never refetches them. An
admin promoting or demoting someone in **Angajați** changes what the backend
authorizes but not what the phone renders: the device keeps showing the old
menus until it re-enrols. The mismatch is silent and lands on the user as
"button does nothing" or a 403.

Fix: refresh the stored user from `GET /api/auth/me` in the boot gate
(`app/index.tsx`), and probably after a 401-refresh too.

*Found while building TODO-19.*

### TODO-25 `[?]` Reconsider flipping `ecotrack.security.enforce` — its rationale is spent
CLAUDE.md's plan is "ship the token-sending build, confirm rollout, then flip",
so that flipping does not log out installed builds mid-route. **That reasoning
no longer holds:** `/api/auth/login` is deleted, so every installed build
predating enrollment already cannot authenticate at all. There is nothing left
to protect from being logged out.

Once the TODO-19 build rolls out, flipping the flag costs nothing it is not
already costing. This needs an explicit decision rather than leaving a stale
justification standing — a safety rule nobody has re-examined is how a
`false` default outlives its reason.

*Found while building TODO-19.* Related: the Appendix says `enforce` defaults to
`true`; `application.properties` says `false`. Settle which is true while
deciding this.

### TODO-26 `[ ]` First-run setup code is only printed to the server log
Whoever performs the very first mobile enrolment needs SSH access to read the
setup code out of the backend log. Workable for the current operator, but it
means the app cannot be bootstrapped by a non-technical user, and it will be
forgotten by the time it matters.

*Found while building TODO-19.*


---

## I. Platform shape

### TODO-22 `[ ]` Make the web app responsive, and move Sales + Technical out of mobile
Two halves of one decision: **the phone stops being a second full app and
becomes a browser**, except for the driver flow.

**1. Responsive web.** Every web screen must work on a phone-sized viewport, not
only on a desktop one. Today the layouts assume width — the sidebar, the
`DataTable` screens (Rute, Sarcini, Comenzi, Angajați), the drawers and the
map — and there is no breakpoint story. Target a real *web-mobile* experience:
a collapsible/off-canvas sidebar, tables that reflow into stacked cards below
the `md` breakpoint instead of being clipped (note `DataTable` is now
`overflow-x-hidden` from TODO-04, so a narrow screen currently *hides* columns
rather than scrolling to them), drawers that become full-screen sheets, and
touch-sized hit targets.

**2. Delete the Sales and Technical sections from `mobile/`.** They are a second
implementation of screens the web already has — `mobile/app/Sales/**`,
`mobile/app/Technical/**` and everything only they use. The mobile app keeps
**only the driver experience**: my routes, my tasks for the day, status changes
and photo upload. Office staff use the responsive web app on their phone.

**Why:** every order-type change, every field, every status rule currently has
to be written twice (see the `order-type` skill — the discriminator is
duplicated across backend, web and mobile with no shared source of truth). One
implementation is simpler, and the web one is the more complete of the two.

**Consequences to handle, not to discover later:**
- `Technical/ChangeDriver.tsx` is referenced by TODO-05 as the reference
  implementation — TODO-05 is `[DONE]` on web, so the web version is now the
  one that matters. Confirm nothing else depends on the mobile screen before
  deleting it.
- The `SecurityConfig` role matrix notes that `PATCH /api/tasks/*/status` and
  `POST /api/tasks/*/photos` are "the only writes the driver app makes". After
  this change that should be literally true — it becomes a checkable invariant
  rather than a comment.
- `mobile/types/OrderTypes.ts` and the order-type duplication mostly disappear
  with Sales. Update the `order-type` skill when it does.
- TODO-19 (mobile enrollment) is still needed — drivers still have to enrol.
- Do the responsive work **before** deleting the mobile screens, so office
  staff are never left without a usable phone surface.

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

### TODO-31 `[DONE]` Delete the dead Google sign-in configuration
Google sign-in was removed with the enrollment work, but its configuration is
still plumbed through **four files** and nothing reads it. Verified: no Java
source references `ecotrack.google.*` at all.

- `backend/src/main/resources/application.properties:70,72` —
  `ecotrack.google.client-id`, `ecotrack.google.allowed-domain`
- `.env.example:39,41,50` — including `VITE_GOOGLE_CLIENT_ID` and the comment
  *"leave empty to hide the Google button"*, describing a button that no longer
  exists
- `docker-compose.yml:52,53,79`
- `.github/workflows/deploy.yml:67,68,73` — plus the `GOOGLE_CLIENT_ID` /
  `GOOGLE_ALLOWED_DOMAIN` **repository secrets**, which should be deleted from
  GitHub too rather than left as credentials nothing uses.

Harmless today, but it is config that documents a feature that is gone — the
next person to read `.env.example` will think Google sign-in is supported.

*Found while correcting CLAUDE.md after TODO-19.*

**Done, and found by a machine rather than by reading.** `dead_config.py`
(TODO-32) flagged both keys on its first run and listed one file more than the
manual sweep had — `docker-compose.dev-hosted.yml`. Removed from:
`application.properties` (whose comment still pointed at the deleted
`AuthService#loginWithGoogle`), `.env.example`, `docker-compose.yml`,
`docker-compose.dev-hosted.yml`, `deploy.yml` (including the `envs:` list),
`web/Dockerfile`, `web/src/lib/config.ts`, `web/src/vite-env.d.ts`, and
`web/src/mocks/seed.ts` (`MOCK_GOOGLE_DEMO_USERNAME`, which nothing imported).

**Still your call, outside the repo:** delete the `GOOGLE_CLIENT_ID` and
`GOOGLE_ALLOWED_DOMAIN` **GitHub repository secrets**. Nothing reads them now,
and a credential nothing uses is one nobody rotates.

*Kept:* `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — mobile's `LocationPicker` genuinely
uses Google Places.

### TODO-32 `[DONE]` Four executable guards for the cross-cutting invariants
Answering "would a knowledge graph help here?": mostly no. The failures this
repo actually has are pairs with **no reference between the halves** — a Java
string literal and a TypeScript one, a comment and the file it names — and a
graph built by static analysis can only contain edges the code already
expresses. It would reproduce the blind spot at higher cost, and the curated
half would rot exactly like the javadoc did. Enforcement beats description.

Built instead, all four wired into CI:

**1. `shared/order-lifecycle-cases.json` — the mirror-pair contract.** 21 golden
cases read by BOTH `OrderFulfilmentPolicySharedCasesTest` (backend) and
`orderLifecycleSharedCases.test.ts` (web), plus 3 backend-only `CANCELLED`
cases. `shared/**` is in the `paths:` filter of both `ci-backend.yml` and
`ci-web.yml` — without that, editing only the fixture would re-run neither suite
and the guard would silently stop guarding.

> **It found a real divergence on its first run.** The web compared date
> strings lexicographically and never validated them, so an unparseable date
> (`"nu se stie"`) sorted *after* today and landed in **Programate** instead of
> **Fără dată**; the backend ran `LocalDate.parse` and treated it as absent. The
> `fulfilled` boolean happened to agree, so TODO-20/21 were not broken and
> nothing else would ever have caught it. `orderLifecycle.ts` now validates the
> ISO shape (and rejects `2026-02-31`, which the shape alone accepts).

**2. `.github/scripts/cross_project_invariants.py`** — order-type names must
match across `Order.java`, `web/types/domain.ts`, `mobile/types/OrderTypes.ts`
and mobile's two untyped local copies; web `TASK_STATUSES` must match the
backend enum except for a declared backend-only set (`CANCELLED`). Verified by
temporarily adding a fourth order type — it named all four files that must
follow. Mobile files absent are *skipped, not failed*, so TODO-22 can delete
them without breaking the guard.

**3. `.github/scripts/doc_claims.py`** — every backticked path in CLAUDE.md and
the skills, and every path in a Java/TS comment, must resolve (understanding
`@/` aliases, `./` relatives and `/.../` elisions); pinned claims must match
`application.properties`; and named cross-references must still hold.

> That last part exists because path-existence alone was **not** enough:
> re-running today's actual stale-javadoc bug passed, since
> `features/map/data.ts` still exists — the *function* had moved out of it. The
> cross-reference check pins the symbol too, and catches it.

**4. `.github/scripts/dead_config.py`** — `ecotrack.*` keys no Java source
reads, reporting the env var's other homes so cleanup is one pass. Bails out
loudly if a `@ConfigurationProperties` class is ever added, since prefix binding
would make key-by-key grepping report false deaths.

2, 3 and 4 run from `repo-hygiene.yml`, which has **no `paths:` filter** — the
whole point is comparing one project against another, so a filtered run would
miss exactly the PR that breaks the pair. Each step is `if: always()` so one
failure does not hide the others.

**Side effect worth knowing:** editing the compose files revealed they match no
`ci-*.yml` filter and had **no CI at all**. Rather than exempt them, the hygiene
workflow now parses `docker-compose*.yml` alongside the workflow YAML, and the
`NO_CI_REQUIRED` entry says the exemption is only valid while that step exists.

Backend 264 tests, web 349, mobile 83 — all green.


---

## Appendix — current state (context)

- **Backend:** enrollment/device-approval auth is complete and tested; passwords
  and Google sign-in are fully removed, config included (TODO-31); `enforce`
  defaults to `true`; refresh tokens last 365 days and rotate on use. Full
  suite: **264 tests**, 0 failing.
- **Web:** enrollment flow shipped (TODO-01). **349 tests**, 0 failing.
- **Mobile:** enrollment shipped (TODO-19) — the app can authenticate again.
  **83 tests**, 0 failing. Sales and Technical sections still present; TODO-22
  plans to remove them.
- **Deploy:** `deploy.yml` (backend + web to VPS, one domain via Caddy) and
  `deploy-mobile.yml` (EAS OTA + builds). See `DEPLOYMENT.md`.
- **No users and no server exist yet**, so nothing here needs a migration path.
