import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * tesseract.js must stay behind a dynamic import, and the engine must stay
 * same-origin.
 *
 * Two separate tripwires that happen to live in the same file because they
 * guard the same import:
 *
 * 1. **Size.** The engine is ~4 MB of WASM plus a 2 MB language model. A single
 *    static `import … from 'tesseract.js'` anywhere on the path from
 *    ClientFormDrawer folds the loader into the sales chunk, and every operator
 *    who ever opens Clienți pays for a scanner most of them will never press.
 *    Same argument as maplibre in `mapPickerIsLazy.test.ts`, one order of
 *    magnitude worse.
 *
 * 2. **Privacy.** tesseract.js DEFAULTS `workerPath`, `corePath` and `langPath`
 *    to jsDelivr. Leaving any of them unset would put a third party in the
 *    request path of an identity-document scan — the exact thing TODO-14 exists
 *    to prevent, arriving through a default nobody wrote down. So this asserts
 *    all three are passed, from our own origin.
 *
 * Source-level rather than a bundle assertion so it fails in `npm test`, next
 * to the change that caused it. CI's bundle budget would not catch either: it
 * measures only the eager chunks, and both of these are lazy.
 */
const OCR = 'src/features/sales/idScan/ocr.ts';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe('the ID scanner engine is loaded lazily', () => {
  it('nothing in sales/ imports tesseract.js statically', () => {
    const offenders = sourceFiles('src/features/sales').filter((file) =>
      /^\s*import[^;]*from 'tesseract\.js'/m.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });

  it('ocr.ts reaches the engine through a dynamic import', () => {
    const source = readFileSync(OCR, 'utf8');
    expect(source).toContain("await import('tesseract.js')");
  });

  it('the panel reaches ocr.ts through a dynamic import too', () => {
    // ocr.ts itself is small, but it is the only module that pulls tesseract.js
    // in — a static import of it defeats the point one level up.
    const panel = readFileSync('src/features/sales/idScan/IdScanField.tsx', 'utf8');
    expect(panel).toContain("import('./ocr')");
    expect(panel).not.toMatch(/^\s*import \{[^}]*\} from '\.\/ocr'/m);
  });
});

describe('the ID scanner engine is served from our own origin', () => {
  const source = readFileSync(OCR, 'utf8');

  it.each(['workerPath', 'corePath', 'langPath'])(
    'sets %s explicitly rather than falling back to the jsDelivr default',
    (option) => {
      expect(source).toMatch(new RegExp(`${option}:`));
    },
  );

  it('names no third-party host', () => {
    expect(source).not.toMatch(/https?:\/\//);
  });

  it('builds those paths from the app base, not a hardcoded root', () => {
    expect(source).toContain('import.meta.env.BASE_URL');
  });
});
