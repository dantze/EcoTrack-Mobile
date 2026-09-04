/**
 * Every Mantine component the app renders has its CSS imported (TODO-60).
 *
 * `src/index.css` used to import five whole Mantine stylesheets — ~332 kB raw
 * for a handful of components — and now imports per-component files instead.
 * That is a 29 kB gzip saving and one new way to be wrong:
 *
 *   **A missing import is not an error.** It is an unstyled control in the
 *   corner of one screen, which nobody sees until they open that screen.
 *
 * TODO-60 said as much, and said this needed "a lint rule or a comment pinning
 * the list next to the imports". This is that rule, and it deliberately does
 * NOT work from a hand-written list of expected components — a second list to
 * keep in sync is the same problem again. It works from the two things that are
 * already true:
 *
 *   1. the `@import '@mantine/…'` lines in `src/index.css`, read from disk;
 *   2. the classes that actually appear in the DOM when the app's Mantine
 *      surface is rendered.
 *
 * If (2) contains something (1) does not style, the test fails and names it.
 * Adding a Mantine component to the app therefore fails here until its CSS is
 * imported, which is the whole point.
 *
 * IT MATCHES ON THE HASHED CLASS, not the readable one. Mantine puts two
 * classes on each element: `m_6c018570`, which its stylesheets actually select
 * on, and `mantine-Input-input`, which exists only so application code has
 * something stable to target and carries no rules at all. Checking for
 * `.mantine-Input-` in the CSS finds nothing even when Input.css is imported —
 * so the hash is the only honest signal that an element is styled, and the
 * readable name is used solely to say WHICH component is missing.
 *
 * WHAT IT CANNOT SEE. jsdom renders the DateInput's popover but not the day
 * grid inside it, so the calendar's own classes never appear here. That gap is
 * covered by a different fact rather than by this test: `@mantine/dates` ships
 * no per-component CSS at all — it is one 32 kB sheet or nothing — so the
 * calendar is styled whole or not at all, and "not at all" would fail on the
 * `DateInput` class this test does see.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateInput } from '../DateInput';

const ROOT = process.cwd();

/** The `@mantine/...` sheets `src/index.css` actually pulls in. */
function importedMantineStylesheets(): string[] {
  const css = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8');
  return [...css.matchAll(/@import\s+'(@mantine\/[^']+\.css)'/g)].map((m) => m[1]!);
}

/** Those sheets, concatenated, as the browser would see them. */
function importedCss(): string {
  return importedMantineStylesheets()
    .map((spec) => readFileSync(join(ROOT, 'node_modules', spec), 'utf8'))
    .join('\n');
}

/**
 * Every styled Mantine element in the DOM, as `{ hash, component }` — the
 * hashed class its stylesheet selects on, and the readable component name from
 * the same element, used only to make a failure legible.
 */
function renderedMantineElements(): { hash: string; component: string }[] {
  const found = new Map<string, string>();
  for (const element of Array.from(document.querySelectorAll('*'))) {
    const classes = Array.from(element.classList);
    const hashes = classes.filter((c) => /^m_[0-9a-f]{6,}$/.test(c));
    if (hashes.length === 0) continue;

    const named = classes.find((c) => /^mantine-[A-Za-z]+-/.test(c));
    const component = named ? /^mantine-([A-Za-z]+)-/.exec(named)![1]! : 'unknown';
    for (const hash of hashes) found.set(hash, component);
  }
  return [...found.entries()]
    .map(([hash, component]) => ({ hash, component }))
    .sort((a, b) => a.component.localeCompare(b.component));
}

describe('Mantine per-component CSS', () => {
  it('imports a stylesheet for every Mantine component the app renders', async () => {
    const user = userEvent.setup();

    // `render` wraps in AppProviders (see src/test/setup.ts), so this mounts
    // the real MantineProvider, ModalsProvider and Notifications host as well
    // as the field — i.e. the app's entire Mantine surface.
    render(<DateInput id="probe-date" label="Data" value={null} onChange={() => {}} />);

    // Opened as well as closed: the dropdown and its controls are a different
    // set of components from the field, and are the ones most likely to lose
    // their styles unnoticed.
    await user.click(screen.getByLabelText('Data'));

    const rendered = renderedMantineElements();
    // Sanity: if the class shapes change, everything below passes vacuously.
    expect(rendered.length).toBeGreaterThan(3);
    expect(rendered.map((e) => e.component)).toContain('Input');

    const css = importedCss();
    const unstyled = rendered
      .filter(({ hash }) => !css.includes(`.${hash}`))
      .map(({ component, hash }) => `${component} (.${hash})`);

    expect(
      [...new Set(unstyled)],
      'These Mantine elements render in the app but no imported stylesheet ' +
        'selects their class, so they appear unstyled. Add the matching ' +
        "`@import '@mantine/core/styles/<Component>.css' layer(mantine);` to " +
        'src/index.css — keeping the layer() wrapper, which is what lets a ' +
        'Tailwind utility beat a Mantine style without !important.',
    ).toEqual([]);
  });

  it('does not import stylesheets for packages the app never imports', () => {
    // The two that were pure dead weight: neither @mantine/spotlight nor
    // @mantine/charts is imported anywhere in src/, so their CSS could never
    // have applied to anything. 24 kB raw between them.
    const sheets = importedMantineStylesheets().join(' ');

    expect(sheets).not.toContain('@mantine/spotlight');
    expect(sheets).not.toContain('@mantine/charts');
  });

  it('still imports the base sheets the component styles are written against', () => {
    // Order matters and so does presence: without default-css-variables every
    // component style resolves its --mantine-* values to nothing.
    const sheets = importedMantineStylesheets();

    expect(sheets).toContain('@mantine/core/styles/baseline.css');
    expect(sheets).toContain('@mantine/core/styles/default-css-variables.css');
    expect(sheets).toContain('@mantine/core/styles/global.css');
  });

  it('keeps every Mantine import inside the mantine cascade layer', () => {
    // The layer is declared above Tailwind's in index.css, and it is the only
    // reason a utility class can override a Mantine style without !important.
    // A per-component import that forgets `layer(mantine)` lands unlayered,
    // which in Tailwind 4 beats every layered rule.
    const css = readFileSync(join(ROOT, 'src', 'index.css'), 'utf8');
    const unlayered = [...css.matchAll(/@import\s+'(@mantine\/[^']+\.css)'([^;]*);/g)]
      .filter((m) => !m[2]!.includes('layer(mantine)'))
      .map((m) => m[1]!);

    expect(unlayered).toEqual([]);
  });
});
