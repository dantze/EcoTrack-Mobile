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
- missing web/mobile literal → silent: the type falls through switches and
  renders as blank or "unknown", with no type error

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
3. **`OrderService`** — creation and update are `@Transactional`; task
   generation and any inventory adjustment for the new type go inside them.
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
   errors** — do it early and let `tsc` find the rest.
2. **`features/sales/orderModel.ts`** — the big one. Type guard
   (`isAmplasare`-style) plus a branch in every `switch (order.orderType)`:
   `orderPrimaryDate`, `orderDateLabel`, `orderAddress`, `orderCoordinates`,
   `orderSummary`, `orderToForm`, `validateOrderForm`, and a
   `build<Type>Payload`.
3. **`components/domain`** — `ORDER_TYPE_LABELS` is a
   `Record<OrderTypeTag, string>`, so a missing entry **is** a type error.
   Labels are Romanian.
4. **`features/sales/suggestions.ts`** — history heuristics switch on type; a
   new type silently produces no suggestions until handled.
5. **`api/live/normalize.ts`** and the mocks — see the `web-data-layer` skill.

## Mobile

`mobile/types/OrderTypes.ts` — the same shape, independently declared:

```ts
export type AmplasareOrder = { orderType: 'Amplasari'; /* … */ };
export type Order = AmplasareOrder | RidicareOrder | IgienizareOrder;
export const isAmplasare = (o: Order): o is AmplasareOrder => o.orderType === 'Amplasari';
```

Add the member, the union arm, and the `is<Type>` guard.

Then the literals that are **not** in that file. Mobile has no single
`ORDER_TYPES` constant — it has two local copies, and neither is typed against
the union, so **nothing here fails at compile time**:

- `mobile/modals/OrderFilterModal.tsx` — a local `ORDER_TYPES` array of
  `{ value, label }` pairs (labels are the singular Romanian forms:
  `Amplasare`, `Ridicare`, `Igienizare`)
- `mobile/app/Sales/OrderDetails.tsx` — a bare
  `["Amplasari", "Ridicari", "Igienizari"]`

Grep before assuming those are the only two:

```bash
grep -rn "Amplasari\|Ridicari\|Igienizari" mobile/
```

This is the project most likely to be left behind.

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
