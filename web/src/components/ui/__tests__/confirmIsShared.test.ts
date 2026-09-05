/**
 * There is ONE confirmation dialog (TODO-77).
 *
 * There used to be two. The kit's `useConfirm` is a module-level queue rendered
 * by an always-mounted `ConfirmHost` on shadcn's `AlertDialog`; a feature-local
 * copy under `features/sales/components/` — deleted, so deliberately not named
 * as a path here — was built on the kit's `Modal` and handed the caller a node
 * to render itself.
 *
 * They were not interchangeable, and the difference was invisible: the local one
 * rendered `role="dialog"` rather than `alertdialog`, and — the part that
 * mattered — it had none of TODO-58's handling for a confirm opened on top of a
 * Drawer or Modal, so from inside an overlay it was `aria-hidden` to a screen
 * reader. On `ClientsPage` that was reachable in practice: the delete is raised
 * from the detail pane, which below `lg` is a Sheet.
 *
 * TODO-77 recorded one caller. There were four. This test exists because that
 * kind of undercount is exactly how the second implementation survived.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');
const SELF = 'confirmIsShared.test.ts';

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (/\.tsx?$/.test(entry.name) && entry.name !== SELF) found.push(full);
  }
  return found;
}

describe('the confirmation dialog', () => {
  it('is only ever imported from the kit', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      // The kit is where it is defined; it imports from its own modules.
      if (file.includes(join('components', 'ui'))) continue;

      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/import\s*\{[^}]*\buseConfirm\b[^}]*\}\s*from\s*'([^']+)'/g)) {
        const from = match[1]!;
        if (from !== '@/components/ui') {
          offenders.push(`${file.slice(SRC.length + 1)} imports useConfirm from '${from}'`);
        }
      }
    }

    expect(
      offenders.sort(),
      "useConfirm must come from '@/components/ui'. A second implementation is " +
        'how the app ended up with two confirms whose accessibility differed — ' +
        'see the comment at the top of this file.',
    ).toEqual([]);
  });

  it('has no feature-local implementation left', () => {
    const survivors = sourceFiles(SRC)
      .filter((f) => !f.includes(join('components', 'ui')))
      .filter((f) => /useConfirm\.tsx?$/.test(f))
      .map((f) => f.slice(SRC.length + 1));

    expect(survivors).toEqual([]);
  });
});
