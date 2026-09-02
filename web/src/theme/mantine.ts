/**
 * Mantine theme, bridged onto the token system in src/index.css.
 *
 * Mantine and shadcn/ui are both in this app on purpose: shadcn owns the
 * chrome (buttons, dialogs, menus, tables), Mantine owns the hard inputs
 * (dates, combobox, spotlight, charts) where its components are simply better.
 * The two only look like one product if they read the SAME variables — so no
 * colour literal appears here that is not also a CSS variable in index.css.
 *
 * `cssVariablesResolver` runs once per colour-scheme change and rewrites the
 * `--mantine-*` variables Mantine's own stylesheets consume.
 */

import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type MantineThemeOverride,
} from '@mantine/core';

/** Communication blue — matches `--accent-*` in index.css. */
const accent: MantineColorsTuple = [
  '#eff6fd',
  '#dbeafe',
  '#bfdcf7',
  '#8ec2ef',
  '#4a9ae0',
  '#0f6cbd',
  '#0c5697',
  '#0a4478',
  '#08355d',
  '#062544',
];

/** Brand navy — the rail and the deepest chrome. */
const navy: MantineColorsTuple = [
  '#eef4fb',
  '#dae7f6',
  '#b7cde8',
  '#8db0d6',
  '#5a86b5',
  '#2c5a8f',
  '#1f3f63',
  '#16283c',
  '#11202f',
  '#0d1826',
];

/** Cool neutral ramp — Mantine's `gray` is warmer than our surfaces. */
const slate: MantineColorsTuple = [
  '#f7f8fa',
  '#eceff3',
  '#e2e6ec',
  '#c8d0da',
  '#a8b3c1',
  '#8b96a5',
  '#5a6472',
  '#3b4450',
  '#242b35',
  '#14181f',
];

export const mantineTheme: MantineThemeOverride = createTheme({
  primaryColor: 'accent',
  primaryShade: { light: 5, dark: 4 },
  colors: { accent, navy, slate },
  // Everything in this app is a dense back-office control; `sm` is the size
  // the whole UI kit passes, so it is also the default.
  defaultRadius: 'md',
  fontFamily:
    "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Inter', ui-sans-serif, system-ui, 'Helvetica Neue', sans-serif",
  fontFamilyMonospace: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Segoe UI Mono', monospace",
  headings: {
    fontFamily:
      "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Inter', ui-sans-serif, system-ui, sans-serif",
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '1.375rem', lineHeight: '1.3' },
      h2: { fontSize: '1.125rem', lineHeight: '1.35' },
      h3: { fontSize: '1rem', lineHeight: '1.4' },
      h4: { fontSize: '0.9375rem', lineHeight: '1.4' },
      h5: { fontSize: '0.875rem', lineHeight: '1.45' },
      h6: { fontSize: '0.8125rem', lineHeight: '1.45' },
    },
  },
  fontSizes: {
    xs: '0.6875rem',
    sm: '0.8125rem',
    md: '0.875rem',
    lg: '1rem',
    xl: '1.125rem',
  },
  radius: {
    xs: '0.25rem',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.625rem',
    xl: '0.875rem',
  },
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.75rem',
  },
  shadows: {
    xs: 'var(--shadow-card-v)',
    sm: 'var(--shadow-card-v)',
    md: 'var(--shadow-popover-v)',
    lg: 'var(--shadow-modal-v)',
    xl: 'var(--shadow-modal-v)',
  },
  // Matches the Tailwind breakpoints the layout is written against, so a
  // Mantine `visibleFrom`/`hiddenFrom` and a `md:` utility flip together.
  breakpoints: {
    xs: '30em', // 480px
    sm: '40em', // 640px
    md: '48em', // 768px
    lg: '64em', // 1024px
    xl: '80em', // 1280px
  },
  cursorType: 'pointer',
  focusRing: 'auto',
  components: {
    // Mantine's default input height is taller than a shadcn control; these
    // defaults line the two up in the same toolbar.
    InputWrapper: { defaultProps: { inputWrapperOrder: ['label', 'input', 'description', 'error'] } },
  },
});

/**
 * Re-points Mantine's own variables at ours.
 *
 * Only the ones that decide whether a Mantine control reads as part of this
 * app are listed — surfaces, text, borders, radius. Mantine's colour ramps are
 * already ours via `colors` above.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--mantine-font-family': 'var(--font-sans)',
    '--mantine-font-family-monospace': 'var(--font-mono)',
    '--mantine-radius-default': 'var(--radius)',
  },
  light: {
    '--mantine-color-body': 'var(--surface)',
    '--mantine-color-text': 'var(--ink)',
    '--mantine-color-dimmed': 'var(--ink-muted)',
    '--mantine-color-placeholder': 'var(--ink-subtle)',
    '--mantine-color-default': 'var(--surface)',
    '--mantine-color-default-hover': 'var(--surface-hover)',
    '--mantine-color-default-border': 'var(--border-color)',
    '--mantine-color-default-color': 'var(--ink)',
    '--mantine-color-error': 'var(--danger-600)',
  },
  dark: {
    '--mantine-color-body': 'var(--surface)',
    '--mantine-color-text': 'var(--ink)',
    '--mantine-color-dimmed': 'var(--ink-muted)',
    '--mantine-color-placeholder': 'var(--ink-subtle)',
    '--mantine-color-default': 'var(--surface-raised)',
    '--mantine-color-default-hover': 'var(--surface-hover)',
    '--mantine-color-default-border': 'var(--border-color)',
    '--mantine-color-default-color': 'var(--ink)',
    '--mantine-color-error': 'var(--danger-600)',
  },
});
