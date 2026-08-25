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

  // ─── Tests ───────────────────────────────────────────────────────────────
  // Vitest reuses the config above, so the `@` alias resolves in tests exactly
  // as it does in the app — which matters, because the rule that feature code
  // imports only `@/api` is what keeps mock and live substitutable, and a test
  // harness with its own alias table could quietly break that.
  test: {
    environment: 'jsdom',
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
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      // Report only, no thresholds — same stance as JaCoCo on the backend.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
