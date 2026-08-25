// ESLint flat config for the Expo / React Native app.
//
// Same stance as web/eslint.config.js: first lint pass over a codebase written
// without one, so it targets real defects and downgrades — never disables —
// rules that would need a broad refactor. See that file for the full rationale.
//
// Differences from web:
//   - globals are React Native's, not the browser's (`__DEV__`, `fetch`,
//     `setTimeout` etc. come from `globals.node` + the RN extras below);
//   - no react-refresh plugin: Expo's Fast Refresh has its own constraints and
//     the web plugin's heuristics do not apply to expo-router route modules,
//     where a default-exported screen alongside route config is the norm;
//   - `app/**` is expo-router's file-based routing. Those files are entered by
//     the router, never imported, so unused-export style rules would be wrong.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'dist/**',
      'assets/**',
      'google-services.json',
    ],
  },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        ...globals.browser,
        // React Native / Metro injects these.
        __DEV__: 'readonly',
        ErrorUtils: 'readonly',
        HermesInternal: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // ── Errors ───────────────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
      'no-unreachable-loop': 'error',

      // ── Warnings: real signal, cleared file-by-file ──────────────────────
      // Same reasoning as web: the service layer types wire payloads loosely.
      '@typescript-eslint/no-explicit-any': 'warn',

      // eslint-plugin-react-hooks v7 ships the React Compiler diagnostics.
      // `rules-of-hooks` and `exhaustive-deps` stay errors (genuine bugs); the
      // compiler-era rules below flag patterns that are correct today but block
      // React Compiler adoption, and clearing them is a screen-by-screen
      // refactor. Warnings keep the backlog countable without gating PRs.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',

      // `require('./assets/x.png')` is how Metro resolves a static asset into a
      // module id; there is no ESM equivalent that survives the bundler, so the
      // rule is simply wrong for React Native. Off, not downgraded — a warning
      // here would never be actionable.
      '@typescript-eslint/no-require-imports': 'off',

      // `console.log` is how this app is debugged on a device today; the
      // services log deliberately. Off rather than a permanent warning wall.
      'no-console': 'off',
    },
  },

  // Config files run in Node at build time.
  {
    files: ['*.config.js', 'eslint.config.mjs', 'vitest.config.ts'],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
