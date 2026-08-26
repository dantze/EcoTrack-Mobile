## What changed

<!-- One or two sentences. What behaviour is different after this merges? -->

## Why

<!-- The problem, not the patch. If it fixes a bug, what did the bug do to a user? -->

## Verified how

<!-- Delete what does not apply. "CI is green" is not verification on its own —
     say what you actually ran or clicked. -->

- [ ] `cd backend && ./gradlew build`
- [ ] `cd web && npm run lint && npm run typecheck && npm run test:run && npm run build`
- [ ] `cd mobile && npm run lint && npm run typecheck && npm run test:run`
- [ ] Clicked through the affected screen in a browser / on a device

## Risk

<!-- Anything that could bite in production. Delete the ones that do not apply. -->

- [ ] Touches auth or `ecotrack.security.*` — read the enforcement-flag section of CLAUDE.md first
- [ ] Changes an entity's JSON shape — `web/src/api/live/normalize.ts` is where the web app breaks
- [ ] Adds or changes a DB column — there is no migration tool, `ddl-auto=update` is doing this
- [ ] Adds a mobile write — the role matrix in `SecurityConfig` needs a matching row
- [ ] None of the above
