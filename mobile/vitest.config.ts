import { defineConfig } from 'vitest/config';

/**
 * Node-environment Vitest project for the pure modules only.
 *
 * `jest-expo` is deliberately not used. It pulls a full React Native preset and
 * transform chain, and the logic in this app worth unit-testing imports nothing
 * from react-native: `utils/dateUtils.ts` is plain TypeScript, so it runs with
 * no transform at all. Screens are covered by `npm run typecheck` and, for the
 * API layer, by the backend suite.
 *
 * `types/` stays in the glob but is empty since TODO-33: the order-type union
 * lived there, and order types are now declared once, in `web/`.
 *
 * `services/` is in scope too, but ONLY for tests that mock every native
 * dependency away with a `vi.mock` factory — a factory means the real module is
 * never loaded, so `@react-native-async-storage/async-storage` and friends
 * never reach the transform chain. A services test that forgets to do that will
 * fail loudly on the import, which is the intended signal.
 *
 * Keep the `include` glob narrow. Widening it to `**\/*.test.ts` would start
 * pulling in files that import `react-native` and the whole reason this config
 * is cheap disappears.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['{utils,types,constants,services}/**/*.test.ts'],

    // Pinned, because the code under test is timezone-sensitive and would
    // otherwise pass locally and fail in CI. `dateUtils.toDateString` formats
    // with `toISOString()`, which is UTC: at 23:30 in Bucharest it already
    // reports tomorrow's date. GitHub runners are UTC; the users are in
    // Romania. See the note in dateUtils.test.ts.
    env: { TZ: 'Europe/Bucharest' },
  },
});
