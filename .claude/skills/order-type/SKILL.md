---
name: order-type
description: Use when adding, renaming or removing an Order subtype (currently Amplasari / Ridicari / Igienizari) anywhere in the monorepo, or when changing the fields on one. The discriminator is duplicated across backend, web and mobile with no shared source of truth, so the change spans all three projects at once — this lists every file that must move together and what breaks if one is missed.
---

# Adding or changing an Order subtype

`Order` uses JPA `InheritanceType.JOINED` with a Jackson `orderType`
discriminator. The three type names — `"Amplasari"`, `"Ridicari"`,
`"Igienizari"` — are **string literals duplicated in all three projects**.
Nothing generates them from a shared schema, and nothing fails at build time
when they drift.

Failure modes when a file is missed:

- missing `@JsonSubTypes` entry → Jackson throws at **runtime**, on first
  deserialisation of that type
- missing web literal → mostly a compile error, if you widen `ORDER_TYPES` first
- missing mobile literal → **silent**: the type falls through switches and
  renders as blank or "unknown", with no type error anywhere

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

## Mobile

**This is the project most likely to be left behind, and the only one where
being left behind is silent.** There is no `ORDER_TYPES` constant and no
exhaustive `Record`, so nothing here fails at compile time. Grep first and treat
the hit list as the work list — there are well over a hundred occurrences:

```bash
grep -rn "Amplasari\|Ridicari\|Igienizari" mobile/ --include="*.ts" --include="*.tsx"
```

The ones that always need editing:

- **`mobile/types/OrderTypes.ts`** — the shape, independently declared:
  ```ts
  export type Order = AmplasareOrder | RidicareOrder | IgienizareOrder;
  export const isAmplasare  = (o: Order): o is AmplasareOrder  => o.orderType === 'Amplasari';
  export const isRidicari   = (o: Order): o is RidicareOrder   => o.orderType === 'Ridicari';
  export const isIgienizari = (o: Order): o is IgienizareOrder => o.orderType === 'Igienizari';
  ```
  Add the member, the union arm, and the guard. (Note the guard names are
  `isRidicari` / `isIgienizari`, not the singular forms web uses.)
- **`mobile/utils/orderUtils.ts`** — `getDateInfo`, `getLocationText`,
  `getActionText`, `getOrderTypeLabel` all branch on the type. A missing branch
  is what produces a card with a blank date or address.
- **`mobile/modals/OrderFilterModal.tsx`** — a local `ORDER_TYPES` array of
  `{ value, label }` pairs (labels are the singular Romanian forms:
  `Amplasare`, `Ridicare`, `Igienizare`).
- **`mobile/app/Sales/OrderDetails.tsx`** — a bare
  `["Amplasari", "Ridicari", "Igienizari"]` plus a `switch` rendering one of
  `app/Sales/OrderTypes/{Amplasari,Ridicari,Igienizari}.tsx`; a new type needs a
  screen of its own there.
- **`mobile/types/__tests__/OrderTypes.test.ts`** — the mobile counterpart of
  `OrderJsonSubTypesTest`. Extend it; it is the only automated guard on this side.

## Conventions

- Type names and `orderType` values are Romanian and stay exactly as spelled
  (`"Amplasari"`, not `"Amplasări"` — the existing values are unaccented).
- User-facing labels are Romanian; identifiers and comments English.

## Verify — all three, because the change spans all three

```bash
cd backend && ./gradlew build
cd web     && npm run lint && npm run typecheck && npm run test:run && npm run build
cd mobile  && npm run lint && npm run typecheck && npm run test:run
```

A green backend proves nothing about the clients here. See the `verify` skill.
