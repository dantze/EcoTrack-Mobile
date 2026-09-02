---
name: web-ui-shadcn
description: Use when writing or changing ANY component under `web/src` — every screen, dialog, table, toolbar and form control in the web app is built on shadcn/ui primitives from `@/components/shadcn`. Covers where the primitives live, the token vocabulary (`bg-surface`, `text-ink-muted`, `border-border`) that makes light and dark mode work with no `dark:` overrides, the Outlook-style layout primitives, the frozen UI-kit contract that feature screens code against, and the rules that keep the two component libraries reading as one product. Also use to add a new shadcn component with the CLI, or to debug a control that looks wrong in dark mode.
---

# The web UI: shadcn/ui layer

`web/` runs **two** component libraries on purpose. This skill covers shadcn;
`web-ui-mantine` covers the other half and **the split between them is decided,
not negotiable per screen** — see "Which library" below.

## Where things live

| Path | What | Who edits it |
|---|---|---|
| `src/components/shadcn/*` | Raw shadcn primitives, added by the CLI | **Nobody by hand.** Re-add with the CLI, then re-apply local patches |
| `src/components/ui/*` | **The kit.** EcoTrack's own components, built ON the primitives | Feature work goes through here |
| `src/components/ui/types.ts` | The **frozen** prop contract | Additive changes only |
| `src/components/layout/*` | App shell, rail nav, workbench, panes | Shell work |
| `src/theme/*` | Mantine theme, providers, colour scheme | Rarely |
| `src/index.css` | The one token system | Rarely, and never per screen |

**Feature screens import from `@/components/ui`, never from
`@/components/shadcn` directly.** The kit is what keeps 30 screens consistent;
a screen reaching past it is how two "Salvează" buttons end up different sizes.
The kit itself imports the primitives freely — that is its job.

Adding a primitive:

```bash
cd web && npx shadcn@latest add <name> --yes     # lands in src/components/shadcn/
```

`components.json` already points `aliases.ui` at `@/components/shadcn` so the
CLI never overwrites the kit.

## Tokens — the whole colour vocabulary

Written once in `src/index.css`, exposed as Tailwind utilities. **Every one is
an indirection onto a runtime CSS variable that changes under `.dark`, so you
never write a `dark:` colour override.** A `dark:` class in a diff is a bug
unless it is fixing contrast, not colour.

| Use | Class |
|---|---|
| Page floor | `bg-background` |
| Card / pane / row surface | `bg-surface`, raised `bg-surface-raised` |
| Toolbar & table header fill | `bg-surface-header` |
| Row hover / selected | `bg-surface-hover` / `bg-surface-active` |
| Hairlines | `border-border`, heavier `border-border-strong` |
| Primary text | `text-ink` |
| Secondary text | `text-ink-muted` |
| Placeholder / disabled | `text-ink-subtle` |
| Accent (selection, links, primary action) | `bg-primary text-primary-foreground`, `text-accent-500` |
| App rail chrome | `bg-sidebar text-sidebar-foreground` |
| Status | `text-status-new` / `-progress` / `-done` |
| Semantics | `danger-*`, `success-*`, `warning-*`, `info-*` (50/100/200/600/700) |
| Elevation | `shadow-card`, `shadow-popover`, `shadow-modal`, `shadow-panel`, `shadow-toast`, `shadow-sticky` |

Never `bg-white`, `text-slate-500`, `border-gray-200`, or a hex literal in a
component. They are invisible in light mode and wrong in dark mode.

## Which library

Decided per component class, so the same control is never built twice:

**shadcn** — chrome and structure: Button, DropdownMenu, Dialog, Sheet, Popover,
Tooltip, Tabs, Table, Card, Badge, Separator, ScrollArea, Resizable, Sidebar,
Command (⌘K), Sonner (toasts), Collapsible, Avatar, Skeleton, Progress, Empty.

**Mantine** — the hard inputs and anything with real interaction logic:
DatePickerInput / DateInput, Combobox-based autocompletes, MultiSelect,
Spotlight, charts, `@mantine/hooks` (`useDisclosure`, `useDebouncedValue`,
`useHotkeys`, `useMediaQuery`, `useListState`, `useLocalStorage`,
`useElementSize`, `useScrollIntoView`).

If both could do it, shadcn wins — it is styled with our tokens directly.

## Layout primitives (the Outlook feel)

From `@/components/ui` / `@/components/layout`:

- `Workbench` — full-height column: a sticky `CommandBar` over scrolling content.
- `CommandBar` — the ribbon. `left` holds primary/secondary actions, `right`
  holds search + view switches. Collapses overflow into a `⋯` menu under `md`.
- `ListDetail` — the reading-pane split. Resizable on `lg+` (persisted width),
  and **on smaller viewports the detail becomes a full-height Sheet** rather
  than squeezing two panes into 380px.
- `PageHeader`, `Tabs`, `FilterBar`, `EmptyState`, `DataTable` — unchanged
  contract, Outlook styling.

Density is the point: 28–32px rows, 13px text, hairline separators, hover
affordances that appear on the row and not on the page.

## Rules

1. **`className` is for layout, not for repainting a component.** If a variant
   is missing, add it to the kit component, not to a call site.
2. **`cn()` from `@/lib/utils`** for conditional classes. The kit's older `cx`
   is an alias kept for existing call sites.
3. **Every dialog needs a title** (`DialogTitle` / `SheetTitle`), `sr-only` if
   the design hides it. Same for `Drawer`.
4. **No manual `z-index`** on overlays — the primitives stack themselves.
5. **Icons are `lucide-react`**, sized by the component (`[&_svg]:size-4` is
   already in the primitives). Don't add `size-4` at the call site.
6. **Focus is visible.** `focus-visible:ring-2 focus-visible:ring-ring` or the
   primitive's own ring. Never `outline-none` without a replacement.
7. **Responsive is not optional.** Every screen must work at 390px wide: the
   rail collapses to a Sheet, tables switch to the card list the kit provides
   (`DataTable` does this itself — do not roll a second one), and toolbars
   overflow into a menu.
8. **Romanian user-facing strings**, English identifiers. Unchanged.

## Testing

`npm run test:run` in `web/`. When running only your own files, use
`npx vitest run <path>` and `npx tsc --noEmit` (not `tsc -b`, which fights
other concurrent runs over `tsconfig.tsbuildinfo`).

Radix/shadcn overlays render in a portal — assert with
`screen.getByRole('dialog')`, not by walking the container. `ResizeObserver`,
`matchMedia` and `scrollIntoView` are stubbed in `src/test/setup.ts`; if a new
primitive needs another browser API, stub it there rather than in the test.
