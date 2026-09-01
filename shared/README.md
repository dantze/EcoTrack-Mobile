# `shared/`

Cross-language contracts. Everything here is **read by more than one project**,
and exists because the edge it describes cannot be expressed in either language.

There is no build step and no code generation — a file lands here only when two
independently-written implementations have to agree and nothing in either
toolchain would notice if they stopped.

## `order-lifecycle-cases.json`

Golden cases for "is this order finished?", asserted by **both** sides of a
deliberate mirror pair:

| | |
|---|---|
| `backend/.../service/OrderFulfilmentPolicy.java` | refuses to retire a subscription that live orders still reference (TODO-20) |
| `web/src/lib/orderLifecycle.ts` | decides what belongs in Comenzi vs Arhivă (TODO-21) |

Read by `OrderFulfilmentPolicySharedCasesTest` (backend) and
`orderLifecycleSharedCases.test.ts` (web).

The two implementations share no code and never call each other. Before this
file, "they must agree" was a sentence in a javadoc — and that javadoc had
already gone stale, pointing at `web/src/features/map/data.ts` after the
function moved. Prose cannot fail a build.

**Changing the rule means editing three things:** the Java, the TypeScript, and
this file. That is the point — a change that only lands in one implementation
fails the other's suite.

`cases` are asserted by both. `backendOnlyCases` cover `CANCELLED`, which
exists in the backend `TaskStatus` enum but not in the web union, so the web
side cannot construct them; they pin the documented collapse of `CANCELLED`
onto `NEW`.

### Adding to it

Both suites iterate every case, so a new entry needs no test code:

```json
{ "name": "what this pins down",
  "order": { "orderType": "Igienizari", "sanitationDate": "2026-08-01" },
  "tasks": ["NEW"],
  "lifecycle": "overdue",
  "fulfilled": false }
```

`lifecycle` is the richer web-side answer; `fulfilled` is the boolean both
share and must be `lifecycle === "done"`. A case may override the global
`today`. Order fields are only the ones the rule reads — dates,
`isIndefinite`, and the type discriminator.

### CI

`shared/**` is in the `paths:` filter of **both** `ci-backend.yml` and
`ci-web.yml`. It has to be: editing only this file must re-run both suites, or
the guard silently stops guarding.
