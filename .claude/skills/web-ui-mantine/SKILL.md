---
name: web-ui-mantine
description: Use when a screen in `web/` needs a date picker, a searchable/creatable combobox, a multi-select, the ⌘K spotlight, a chart, or one of the `@mantine/hooks` — Mantine covers the inputs and interaction logic that shadcn/ui does not, and it is themed to the same tokens so the two read as one product. Covers the theme bridge in `src/theme/`, which Mantine packages are eager vs lazy (bundle budget), the Styles API overrides the kit relies on, and the rules for keeping Mantine controls the same height and colour as shadcn ones. Use `web-ui-shadcn` for everything structural.
---

# The web UI: Mantine layer

Mantine is here for the components that are genuinely hard to build well, and
for its hooks. It is **not** a second styling system: every Mantine control in
this app reads the same CSS variables as the shadcn ones.

## Theme bridge — how they end up matching

- `src/theme/mantine.ts` — `createTheme`, our `accent` / `navy` / `slate`
  ramps, our font stack, our radii/spacing/shadows, breakpoints aligned with
  Tailwind's, plus a `cssVariablesResolver` that re-points `--mantine-color-*`
  at `--surface`, `--ink`, `--border-color`, …
- `src/theme/ThemeProvider.tsx` — owns light/dark/system, writes BOTH the
  `.dark` class (Tailwind/shadcn) and `data-mantine-color-scheme` (Mantine),
  before first paint via the inline script in `index.html`.
- `src/theme/AppProviders.tsx` — the provider stack. `MantineProvider` is given
  `forceColorScheme`; **it never runs its own colour-scheme manager.**
- `src/index.css` — imports Mantine's stylesheets **into `@layer mantine`**,
  declared below Tailwind's layers. That is what lets a Tailwind utility win
  over a Mantine component style without `!important`. Keep new Mantine CSS
  imports inside that layer.

## Use Mantine for

| Need | Component |
|---|---|
| Date, date range, month | `DatePickerInput`, `DateInput`, `MonthPickerInput` (`@mantine/dates`) |
| Searchable / creatable picker | `Combobox` primitives (see the `mantine-combobox` skill) |
| Multi-select, tags | `MultiSelect`, `TagsInput` |
| Command palette | `@mantine/spotlight` |
| Charts | `@mantine/charts` — **lazy-loaded only** |
| Rich forms | `@mantine/form` (see the `mantine-form` skill) |
| Hooks | `useDisclosure`, `useDebouncedValue`, `useMediaQuery`, `useHotkeys`, `useListState`, `useLocalStorage`, `useElementSize`, `useResizeObserver`, `useScrollIntoView`, `useClickOutside`, `useIntersection` |

Do **not** use Mantine's Button, Modal, Table, Tabs, Menu, Card, Badge or
Tooltip — shadcn owns those, and a second visual dialect is exactly what this
rebuild removed.

## Bundle rules

`@mantine/core` + `@mantine/hooks` are eager (the provider wraps the app) and
have their own Rollup chunk. **`@mantine/dates`, `@mantine/charts`,
`@mantine/spotlight` and `recharts` must stay out of the entry graph** — they
are reached only from lazily-loaded route chunks. Importing `@mantine/charts`
from anything the shell touches puts ~120 kB of recharts on first paint and the
bundle-budget check in CI fails.

`dayjs` is Mantine's date engine and is already a dependency; use it inside
date components rather than adding a second date library. ISO strings
(`YYYY-MM-DD`) remain the app's wire format — convert at the component edge,
never store `Date` objects in query data.

## Making a Mantine control match

Pass `size="sm"` (or `xs` in dense toolbars) and let the theme do the rest. When
a specific part needs to match a shadcn control exactly, use the **Styles API**
with our tokens:

```tsx
<DatePickerInput
  size="sm"
  classNames={{
    input: 'bg-surface border-border text-ink placeholder:text-ink-subtle',
    day: 'data-[selected]:bg-primary data-[selected]:text-primary-foreground',
  }}
/>
```

Never reach for `styles={{ input: { background: '#fff' } }}` — a hex literal is
invisible in dark mode. Never set `withCssVariables={false}`.

## Gotchas

- **Mantine renders dropdowns in a portal.** In tests, query with
  `screen.getByRole('listbox' | 'dialog')`; in the app, don't wrap a dropdown in
  an `overflow-hidden` parent expecting it to clip — it won't.
- **`useMediaQuery` returns `undefined` on the first render** (and in jsdom).
  Treat `undefined` as the desktop case or the layout flashes.
- **Mantine's `Modal`/`Drawer` are unused here**; if you need one, use the
  kit's `Modal`/`Drawer`, which are shadcn `Dialog`/`Sheet`.
- **Notifications**: prefer the kit's `toast()` (Sonner). `@mantine/notifications`
  is mounted for Mantine-internal use only.
- jsdom has no `matchMedia`/`ResizeObserver`; both are stubbed in
  `src/test/setup.ts`. Mantine components that measure will render at size 0 in
  tests — assert on roles and text, not geometry.
