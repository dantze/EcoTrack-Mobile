import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MapLibre must stay behind a dynamic import.
 *
 * The library is ~250 kB gzipped. `/harta` pays that willingly; Comenzi must
 * not, because most orders are typed in from an email and the map picker is
 * never opened. A single `import { … } from 'maplibre-gl'` anywhere on the
 * static path from OrdersPage would fold the whole library into the sales
 * chunk and nobody would notice until the chunk report was read carefully.
 *
 * A source-level tripwire rather than a bundle assertion so it fails in
 * `npm test`, next to the change that caused it, instead of in CI's bundle
 * budget — which does not even measure this, since both chunks are lazy.
 */
const PICKER = 'src/features/sales/components/LocationPickerModal.tsx';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe('the order map picker is loaded lazily', () => {
  it('nothing in sales/ imports maplibre statically except the picker itself', () => {
    const offenders = sourceFiles('src/features/sales')
      .filter((file) => file.replace(/\\/g, '/') !== PICKER)
      .filter((file) => /^\s*import[^;]*from 'maplibre-gl'/m.test(readFileSync(file, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('LocationFields reaches the picker through a dynamic import', () => {
    const fields = readFileSync('src/features/sales/components/fields.tsx', 'utf8');
    expect(fields).toContain("import('./LocationPickerModal')");
    // A type-only import is erased and costs nothing; a value import is not.
    expect(fields).not.toMatch(/^\s*import \{[^}]*\} from '\.\/LocationPickerModal'/m);
  });
});
