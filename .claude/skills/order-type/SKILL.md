---
name: order-type
description: Use when adding, renaming or removing an Order subtype (currently Amplasari / Ridicari / Igienizari) anywhere in the monorepo, or when changing the fields on one. The discriminator is duplicated between backend and web with no shared source of truth, so the change spans both projects at once — this lists every file that must move together and what breaks if one is missed, and why mobile is deliberately not one of them.
---

# Adding or changing an Order subtype

`Order` uses JPA `InheritanceType.JOINED` with a Jackson `orderType`
discriminator. The three type names — `"Amplasari"`, `"Ridicari"`,
`"Igienizari"` — are **string literals duplicated in the backend and in web**.
Nothing generates them from a shared schema, and nothing fails at build time
when they drift.

Failure modes when a file is missed:

- missing `@JsonSubTypes` entry → Jackson throws at **runtime**, on first
  deserialisation of that type
- missing web literal → mostly a compile error, if you widen `ORDER_TYPES` first

There used to be a third copy, in mobile, and it was the dangerous one: nothing
there was typed against the union, so a missed arm rendered blank with no error
anywhere. TODO-33 deleted it. See **Mobile** below — the absence is checked.

## Backend

`backend/src/main/java/com/example/damiProd/domain/`

1. **The subclass** — extends `Order`, `@Entity`, own `@Table`. Model it on
   `AmplasareOrder.java`.
2. **`Order.java` — the `@JsonSubTypes` list.** Both directions depend on it:
   ```java
   @JsonSubTypes({
       @JsonSubTypes.Type(value = AmplasareOrder.class, name = "Amplasari"),
       @JsonSubTypes.Type(value = RidicareOrder.class,  name = "Ridicari"),
       @JsonSubTypes.Type(value = IgienizareOrder.class, name = "Igienizari"),
   })
   ```
   The `name` must match the `orderType` string exactly — it is also persisted
   as a column.
3. **`OrderService`** — `createOrder` and `updateOrder` are `@Transactional`;
   task generation and any inventory adjustment for the new type go **inside**
   them, not in the controller.
4. **`DomainTests/OrderJsonSubTypesTest`** — add the round-trip case. This test
   exists *because* the names are duplicated; it is the closest thing to a
   guard.

There is **no migration tool** (`ddl-auto=update`, and local dev is H2 while
prod is Postgres) — a new joined table appears on boot. Renaming an existing
type is a data change with no migration path; treat it as a separate decision.

## Web

`web/src/`

1. **`types/domain.ts`** — the interface, add it to the `Order` union, and add
   the literal to:
   ```ts
   export const ORDER_TYPES = ['Amplasari', 'Ridicari', 'Igienizari'] as const;
   export type OrderTypeTag = (typeof ORDER_TYPES)[number];
   ```
   Widening `ORDER_TYPES` is what turns the remaining steps into **compile
   errors** — do it early and let `tsc` find the rest. Every
   `Record<OrderTypeTag, …>` in the app becomes an error until it is filled in:
   `ORDER_TYPE_LABELS` and `ORDER_TYPE_PLURAL_LABELS` in `components/domain.tsx`,
   `TYPE_DOT` in `features/sales/components/MonthGrid.tsx`, `ORDER_TYPE_COLOR`
   in `features/map/types.ts`, and `OrderCounts` in `features/sales/calendar.ts`.
   All labels are Romanian.
2. **`features/sales/orderModel.ts`** — the big one. Add the type guard
   (`isAmplasare`-style), then a branch in every `switch` on the type:
   `orderPrimaryDate`, `orderAddress`, `orderCoordinates`, `orderSummary`,
   `orderToForm`, `validateOrderForm`. `orderDateLabel` branches through the
   guards instead of a switch, so it needs reading rather than a mechanical
   edit, and `emptyOrderForm` is a **flat** state bag covering all types at
   once — the new type's fields go in there and it will not error if you forget.
   Finally add a `build<Type>Payload`.
   **`orderPrimaryDate` is the one definition of which day an order belongs to**
   — the Comenzi table, its filters and the calendar all read it, so a new type
   with no branch there lands nowhere.
3. **`features/sales/suggestions.ts`** — history heuristics branch on type; a
   new type silently produces no suggestions until handled.
4. **`api/live/normalize.ts`** and the mocks — see the `web-data-layer` skill.

## Mobile — nothing to do, and that is now enforced

**An order type is a TWO-place edit: backend and web.** It used to be three,
and mobile was the place most likely to be left behind and the only one where
being left behind was silent — no `ORDER_TYPES` constant, no exhaustive
`Record`, so a missed arm rendered a blank card instead of failing to compile.

TODO-33 deleted mobile's Sales and Technical sections. The driver app reads
`task.type`, which is the task's own type and not the order discriminator, so
it never sees an `orderType` value at all. Mobile's own union declaration, the
local copy in its order filter modal, and the per-type screens went with them.

`.github/scripts/cross_project_invariants.py` now asserts the ABSENCE:
mobile naming any order type in code fails repo-hygiene. So if you are here
because you are adding a screen to mobile that needs to know about order types
— **that is the thing the deletion was for.** Put it in `web/`, which is
responsive and is what office staff use on their phones. If there is a real
reason it must be native, remove the check and record why in `TODO.md`.

## Conventions

- Type names and `orderType` values are Romanian and stay exactly as spelled
  (`"Amplasari"`, not `"Amplasări"` — the existing values are unaccented).
- User-facing labels are Romanian; identifiers and comments English.

## Verify — both, because the change spans both

```bash
cd backend && ./gradlew build
cd web     && npm run lint && npm run typecheck && npm run test:run && npm run build
```

A green backend proves nothing about the client here. See the `verify` skill.

Mobile is not in the list, and repo-hygiene is what keeps that honest: it fails
if mobile starts naming order types again.
