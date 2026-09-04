/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },



  build: {
    rollupOptions: {
      output: {
        // The route table code-splits the eight feature screens (see
        // src/routes/router.tsx); this splits the dependencies they share.
        //
        // The point is cache lifetime, not first-load size: React, the router
        // and TanStack Query change only when someone bumps a version, while
        // app code changes every deploy. Left in the entry chunk, one CSS tweak
        // invalidates ~140 kB of framework for every user. Split out, it stays
        // in their cache across releases.
        //
        // Keep react and react-dom together — they are a matched pair, and
        // splitting them risks loading two copies of the reconciler.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          // maplibre is ~550 kB on its own and is reached only from /harta.
          // Naming it here does NOT pull it into the initial load — nothing in
          // the entry imports it, so it is still fetched lazily alongside the
          // map chunk. What it buys is a cache boundary: the library outlives
          // every deploy, while the map screen's own code does not.
          maplibre: ['maplibre-gl'],
          // Same reasoning for the ID scanner's engine (TODO-13): a cache
          // boundary for a library that outlives the screen using it.
          //
          // It once had a second reason — without a name here Rollup calls the
          // chunk after the package's entry module and emits `index-<hash>.js`,
          // which the old `.github/scripts/bundle_budget.py` read as the EAGER
          // entry chunk and charged 6.7 kB of lazy weight to the initial
          // download. That is fixed at the source now (TODO-47): the script
          // walks the real static import graph out of `dist/index.html`, so the
          // chunk's NAME no longer decides anything. Kept for the cache
          // boundary alone.
          tesseract: ['tesseract.js'],
          // Mantine's core + hooks are eager (MantineProvider wraps the app in
          // src/theme/AppProviders.tsx), so they get their own cache boundary
          // for exactly the reason react/query do: the library changes on a
          // version bump, the app changes every deploy.
          //
          // @mantine/dates, /charts, /spotlight and recharts are deliberately
          // NOT listed — nothing in the entry imports them, so they travel with
          // the screens that do.
          mantine: ['@mantine/core', '@mantine/hooks'],
          // Radix primitives behind the shadcn components. Same argument.
          radix: ['radix-ui'],
        },
      },
    },
  },

  // ─── Tests ───────────────────────────────────────────────────────────────
  // Vitest reuses the config above, so the `@` alias resolves in tests exactly
  // as it does in the app — which matters, because the rule that feature code
  // imports only `@/api` is what keeps mock and live substitutable, and a test
  // harness with its own alias table could quietly break that.
  test: {
    environment: './src/test/jsdomNodeAbort.ts',
    globals: false, // describe/it/expect are imported explicitly
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // The mock API delays every call by MOCK_LATENCY_MS so the UI's loading
    // states are real during development. In tests that is pure wall clock —
    // the contract suite alone makes ~150 calls — so it is zeroed here rather
    // than relying on whoever runs the suite to export it.
    env: { VITE_MOCK_LATENCY_MS: '0' },
    css: false,
    restoreMocks: true,
    // Vitest's default is 5000ms, which this suite outgrew. `screensSmoke` and
    // `bootNavigation` boot the REAL router under the real provider stack, and
    // the first case in a file also pays for loading a screen's module graph —
    // measured at ~4.2s for `/comenzi` on an unloaded machine. Two such files
    // running in parallel push that past 5s and the run fails on a timeout
    // rather than on anything being wrong, which is the worst kind of red.
    //
    // Raised rather than the tests being made shallower: booting the real
    // router is the entire point of both files — it is what caught TODO-48.
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      // Report only, no thresholds — same stance as JaCoCo on the backend.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
