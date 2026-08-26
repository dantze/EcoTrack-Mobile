---
name: api-endpoint
description: Use when adding, changing, moving or deleting any backend `/api/**` endpoint in `backend/` — any new @GetMapping / @PostMapping / @PatchMapping / @PutMapping / @DeleteMapping under `controller/`, or any change to an existing route's path or HTTP verb. Covers the SecurityConfig role-matrix row (and why matcher ORDER matters), the TaskAccessPolicy row-level call that the matrix does not replace, Romanian error messages, and which test classes must be extended. Use it before writing the controller method, not after.
---

# Adding an `/api/**` endpoint

Four things move together. Miss the third and a driver can read another
driver's day — with nothing failing loudly, in any test, in either
enforcement mode.

Work in this order.

## 1. The controller method

Under `backend/src/main/java/com/example/damiProd/controller/`.

- User-facing exception messages are **Romanian** (`"Ruta nu a fost găsită"`).
  Code, identifiers and comments stay English.
- If the endpoint needs to know who is calling, take the principal:
  ```java
  @AuthenticationPrincipal EmployeePrincipal principal
  ```
- Return `ResponseEntity<T>`, matching the surrounding controller.

## 2. The role-matrix row in `SecurityConfig`

`backend/src/main/java/com/example/damiProd/config/SecurityConfig.java`, inside
the `if (enforceSecurity)` branch (~line 187). Role constants are defined at the
top of the class: `ADMIN`, `SALES`, `TECH`, `DRIVER`, and
`OFFICE = { ADMIN, SALES, TECH }`.

**First matching rule wins, so position is the whole game.** The existing rows,
in order:

| Rule | Who |
|---|---|
| `/api/admin/**` | `ADMIN` |
| `POST/PUT/PATCH/DELETE /api/employees/**` | `ADMIN` |
| `PATCH /api/tasks/*/status` | `DRIVER`, `SALES`, `TECH`, `ADMIN` |
| `POST /api/tasks/*/photos` | `DRIVER`, `SALES`, `TECH`, `ADMIN` |
| `POST/PUT/PATCH/DELETE /api/**` | `OFFICE` |
| `GET /api/**` (any verb not above) | authenticated |
| everything else | `denyAll()` |

The two driver rows work **only** because they sit above the
`PATCH /api/**` → `OFFICE` catch-all. A specific matcher added below a
catch-all is dead code that reads as if it works.

So:

- A write that office staff perform → **nothing to add**, the catch-all covers it.
- A write the **driver app** performs → needs its own row, placed **above** the
  catch-alls. There are currently exactly two. A third is a real decision:
  the driver app's write surface is deliberately small.
- A new unauthenticated path → almost certainly wrong. The only ones are
  enrollment (a device has no credential until an admin approves it) and
  `POST /api/auth/refresh` + `/logout`.

## 3. The `TaskAccessPolicy` call — the one that gets forgotten

`service/TaskAccessPolicy.java`. **The matrix answers "which VERBS may this
role use". It does not answer "which ROWS".** Those are different questions and
both have to be answered.

Before this class existed, any authenticated driver could read
`/api/tasks/employee/{someoneElse}` or complete another driver's task just by
sending a different id. The matrix was already in place at the time and did not
help — it never could.

Pick the guard by shape of the endpoint:

| Endpoint takes | Call |
|---|---|
| an employee id in the URL | `accessPolicy.requireCanReadTasksOf(principal, employeeId)` |
| a single task (by id) | `accessPolicy.requireCanAccessTask(principal, task)` |
| nothing scoped — an overview | `accessPolicy.requireOfficeRole(principal)` |
| "my own work" | `accessPolicy.callerId(principal)`, never an id from the client |

All of them throw `AccessDeniedException` with a Romanian message, which the
chain turns into a 403.

**When you do NOT need a policy call:** endpoints the matrix already restricts
to `OFFICE`, because no driver can reach them at all. `POST /api/tasks`,
`PATCH /api/tasks/{id}/scheduled-date`, `DELETE /api/tasks/{id}` and the
reassign routes have no policy call for exactly this reason. If you add a
driver row in step 2, that reasoning no longer holds for that path — go back
and add the guard.

Also: `/api/tasks/mine` and `/mine/date/{date}` exist so the driver app never
sends its own employee id. **The driver app must use those.** A new
"my tasks"-shaped endpoint takes the employee from the token, never from the
client.

## 4. Tests

Under `backend/src/test/java/com/example/damiProd/SecurityTests/`:

- **`AuthorizationMatrixTest`** — add a case per role for the new matcher.
  A new row in step 2 without a case here is untested by construction.
- **`TaskScopingTest`** — required for anything task-shaped. Covers the
  row-level layer against the real filter chain.
- **`AuthEnforcementOnTest` / `AuthEnforcementOffTest`** — extend only if the
  endpoint changes the *shape* of either mode (e.g. a new public path).

Controller-level behaviour goes in `ControllerTests/` as usual.

### The trap

`@WebMvcTest` slices are **not profiled**, so they see the base default
`ecotrack.security.enforce=false` rather than the test profile's `true`. A
`@WebMvcTest` that "proves" your endpoint is guarded proves nothing — the
matrix is inert in that slice. Security assertions belong in the
`@SpringBootTest` classes above, which run the real chain.

## Before you finish

Run the backend suite — matcher ordering mistakes surface there, not at compile
time:

```bash
cd backend && ./gradlew test
```

Then check the web side: if the endpoint is new or its shape changed, the web
data layer needs the matching work — see the `web-data-layer` skill.
