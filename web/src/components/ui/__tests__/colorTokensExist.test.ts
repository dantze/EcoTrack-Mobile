/**
 * Every colour utility in `src/` must name a token that actually exists
 * (TODO-73).
 *
 * THE BUG THIS EXISTS FOR. `AccessRequestsPage` used `text-content` and
 * `text-content-muted` in four places. Neither is declared — the kit's tokens
 * are `text-ink` / `text-ink-muted` — so Tailwind generated no rule for them,
 * the classes compiled to nothing, and those lines silently inherited whatever
 * colour was above them. The inherited colour happened to be close, so the page
 * looked fine and the mistake survived a full browser pass over every screen in
 * both themes.
 *
 * That is the whole problem: a wrong colour token is not a crash, not a type
 * error and not a lint error. It is a class that does nothing, and nothing in
 * the toolchain says so. This is the only check that can.
 *
 * HOW IT WORKS. `src/index.css` declares every app colour twice — a runtime
 * variable, then a `--color-*` indirection inside `@theme inline` that is what
 * makes `text-ink` a real utility. So the `@theme` block IS the list of legal
 * colour names, and anything else has to be either a Tailwind built-in or a
 * non-colour utility that happens to share the prefix (`text-sm`, `border-t`).
 * Both of those are enumerated below, deliberately by hand: an allowlist that
 * has to be edited is the point, because editing it is the moment someone
 * notices they are adding a colour that is not in the token system.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

/** Tailwind's own keywords, which are colours but not ours. */
const BUILTIN_COLORS = new Set(['white', 'black', 'transparent', 'current', 'inherit']);

/**
 * Utilities that share a prefix with a colour utility but set something else.
 * `text-` is the worst offender — size, alignment, wrap and overflow all live
 * under it — which is exactly why a bad `text-*` colour hides so well.
 */
const NON_COLOR_SUFFIXES = new Set([
  // text-: size
  'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
  // text-: alignment, wrapping, overflow
  'left', 'center', 'right', 'justify', 'start', 'end',
  'balance', 'pretty', 'nowrap', 'wrap', 'ellipsis', 'clip',
  // border-: sides and widths
  't', 'r', 'b', 'l', 'x', 'y', 's', 'e',
  't-0', 'r-0', 'b-0', 'l-0', 'x-0', 'y-0',
  '0', '2', '4', '8',
  // border-: style and table behaviour
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'none',
  'collapse', 'separate', 'spacing-0',
  // bg-: attachment, sizing, repeat, clip, blend
  'cover', 'contain', 'no-repeat', 'repeat', 'fixed', 'local', 'scroll',
  'clip-padding', 'clip-border', 'clip-content', 'clip-text', 'blend-color',
  // ring-
  'inset', 'offset-1', 'offset-2', 'offset-4',
]);

/**
 * MapLibre layout/paint property names, which appear as STRING KEYS in the map
 * style and are not CSS at all — `text-field`, `text-size`, `text-color`,
 * `text-font`, `text-allow-overlap`. The scan below reads whole files rather
 * than parsing JSX, so it sees them; excluding the map files instead would
 * blind the check to the real classes those files also contain.
 */
const MAPLIBRE_PROPERTIES = new Set([
  'allow-overlap', 'color', 'field', 'font', 'size',
]);

/** `<prefix>-<name>` where a colour is legal. */
const COLOR_PREFIXES = /(?:^|[\s"'`:{])(text|bg|border|ring)-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/g;

function declaredColorTokens(): Set<string> {
  const css = readFileSync(join(SRC, 'index.css'), 'utf8');
  const theme = css.slice(css.indexOf('@theme inline'));
  return new Set([...theme.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]!));
}

/**
 * This file is skipped, for the reason `repo_hygiene.py` skips itself: it holds
 * the offending patterns as prose and allowlist entries (`text-content`,
 * `text-slate-500`), so scanning it reports the examples in its own error
 * message.
 */
const SELF = 'colorTokensExist.test.ts';

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry.name) && entry.name !== SELF) found.push(full);
  }
  return found;
}

describe('colour tokens', () => {
  it('declares every colour utility used in src/', () => {
    const declared = declaredColorTokens();
    // Sanity: if the @theme parse breaks, everything below passes vacuously.
    expect(declared.size).toBeGreaterThan(50);
    expect(declared.has('ink')).toBe(true);

    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(COLOR_PREFIXES)) {
        const name = match[2]!;
        if (
          declared.has(name) ||
          BUILTIN_COLORS.has(name) ||
          NON_COLOR_SUFFIXES.has(name) ||
          MAPLIBRE_PROPERTIES.has(name)
        ) {
          continue;
        }
        // `ring-offset-<color>` and `border-<side>-<color>` compose a colour
        // onto a modifier; check the colour half.
        const tail = name.slice(name.lastIndexOf('-') + 1);
        if (declared.has(tail) || BUILTIN_COLORS.has(tail)) continue;

        offenders.push(`${match[1]}-${name}  (${file.slice(SRC.length + 1)})`);
      }
    }

    expect(
      [...new Set(offenders)].sort(),
      'These colour classes name a token that is not declared in index.css\'s ' +
        '@theme block, so Tailwind emits no rule for them and they silently do ' +
        'nothing. Use a kit token (text-ink, bg-surface, border-border, …), or ' +
        'add the token — do not add a raw palette colour like text-slate-500.',
    ).toEqual([]);
  });
});
