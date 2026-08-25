// ESLint flat config for the web app.
//
// Scope decision: this is the FIRST lint pass over a codebase that was written
// without one, so it is tuned to catch real defects (unused code, unsafe `any`
// escapes, broken hook dependencies, unreachable branches) without demanding a
// repo-wide refactor before it can go green.
//
// Two knobs express that:
//   - the type-aware ruleset is NOT enabled. `recommendedTypeChecked` would add
//     ~10x the findings, almost all of them "this promise is unawaited" style
//     noise on code that is already correct, and it roughly triples lint time.
//     `npm run typecheck` already runs the compiler over the same files.
//   - rules that would need broad refactors are downgraded to 'warn' with a
//     comment saying why, rather than switched off. A warning is a visible
//     backlog item; a disabled rule is invisible. `npm run lint` fails on
//     errors only, so the backlog does not block anyone.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    // Build output and dependencies are never linted.
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.tsbuildinfo'],
  },

  // ─── Application source ──────────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // ── Errors: things that are defects, not style ────────────────────────

      // An unused variable is either dead code or a typo in a rename. The
      // `_`-prefix escape hatch keeps intentionally-ignored positional args
      // (event handlers, destructuring rest) legal.
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

      // `@ts-ignore` silences the compiler with no explanation;
      // `@ts-expect-error` at least fails when the underlying problem is fixed.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],

      // ── Warnings: real signal, but fixing them all is a separate PR ───────

      // `any` erases the type safety the rest of the app relies on. There are
      // legitimate uses at the wire boundary (normalize.ts) and in a few
      // generic UI components; turning this to 'error' today would mean either
      // a large typing pass or a scattering of inline disables, both worse than
      // a standing warning count.
      '@typescript-eslint/no-explicit-any': 'warn',

      // eslint-plugin-react-hooks v7 ships the React Compiler diagnostics, which
      // are a much stricter analysis than the classic v4/v5 rules. The two
      // classic ones — `rules-of-hooks` and `exhaustive-deps`, both left at
      // 'error' by the recommended preset above — catch genuine bugs and stay
      // errors. The compiler-era rules below each flag a *pattern* that is
      // usually correct today but blocks React Compiler adoption, and clearing
      // them means restructuring components across most of the feature layer.
      // They are warnings so the backlog is visible and countable without a
      // repo-wide refactor gating every PR. Fix them file-by-file, then promote
      // the rule back to 'error'.
      'react-hooks/set-state-in-effect': 'warn',   // 16 sites: derive-state-from-props effects
      'react-hooks/refs': 'warn',                  // 5 sites: ref written/read during render
      'react-hooks/immutability': 'warn',          // 1 site
      'react-hooks/globals': 'warn',               // 1 site: module-level id counter
      'react-hooks/preserve-manual-memoization': 'warn',

      // react-refresh only works when a module exports components exclusively.
      // Several feature modules deliberately co-locate a component with its
      // constants/helpers; splitting them is a refactor, and the only cost of
      // leaving them is a full reload instead of a hot one during dev.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // ── Correctness rules the base config does not enable ────────────────
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-template-curly-in-string': 'warn',

      // `console.log` left in shipped code is noise; warn/error are intentional.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ─── Tests ───────────────────────────────────────────────────────────────
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/test/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Test files legitimately build deliberately-malformed wire payloads and
      // cast them, which is the whole point of a normaliser test.
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
      'no-console': 'off',
    },
  },

  // ─── Config files that run in Node, not the browser ──────────────────────
  {
    files: ['*.config.{js,ts}', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
