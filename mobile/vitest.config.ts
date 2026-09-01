import { defineConfig } from 'vitest/config';

/**
 * Node-environment Vitest project for the pure modules only.
 *
 * `jest-expo` is deliberately not used. It pulls a full React Native preset and
 * transform chain, and the logic in this app worth unit-testing imports nothing
 * from react-native: `utils/*` and `types/OrderTypes.ts` are plain TypeScript,
 * so they run with no transform at all. Screens are covered by
 * `npm run typecheck` and, for the API layer, by the backend suite.
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
    // otherwise pass locally and fail in CI. `orderUtils.getDateInfo` parses
    // 'YYYY-MM-DD' with `new Date(s)`, which JavaScript reads as UTC midnight,
    // then reads it back with the *local* `getDate()`/`getMonth()`. West of UTC
    // that shifts every bare date one day earlier. GitHub runners are UTC;
    // the users are in Romania. See the note in orderUtils.test.ts.
    env: { TZ: 'Europe/Bucharest' },
  },
});
