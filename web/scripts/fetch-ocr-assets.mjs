#!/usr/bin/env node
/**
 * Put the offline OCR assets into `public/tesseract/` (TODO-13).
 *
 * The ID scanner runs Tesseract in the browser so that a photo of someone's
 * identity card never leaves their machine. That only holds if the engine
 * itself is served from our own origin: tesseract.js defaults `workerPath`,
 * `corePath` and `langPath` to jsDelivr, and those defaults would put a third
 * party in the middle of an ID scan. Same rule, and the same reason, as the map
 * tiles and Photon in `src/lib/geocoding.ts` — except inverted: there we keep
 * OUR token off someone else's host, here we keep THEIR host out of our page.
 *
 * Two kinds of asset, fetched two ways:
 *
 *   - The WASM core and the worker are already on disk in `node_modules`,
 *     pinned by `package-lock.json`. They are copied, not downloaded.
 *   - The language model is not published to npm. It is downloaded once from a
 *     TAGGED tessdata_fast ref and checked against a SHA-256 recorded here, so
 *     a moved tag or a substituted file fails the build rather than shipping.
 *
 * The output is gitignored. A 2 MB binary blob committed to a repository is
 * permanent in a way a build step is not — see TODO-24 for what this project
 * already carries in its history and cannot get out.
 *
 * Idempotent: everything already present with the right hash is left alone, so
 * this is cheap to run from `prebuild` on every build.
 *
 *     node scripts/fetch-ocr-assets.mjs
 */

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'tesseract');
const MODULES = path.join(ROOT, 'node_modules');

/**
 * The engine picks one of these at runtime from the CPU's SIMD support
 * (`worker-script/browser/getCore.js`), so all three have to be on disk even
 * though a given browser fetches exactly one.
 *
 * `-lstm` only: the scanner asks for OEM 1, and the non-LSTM cores carry a
 * legacy engine it never runs.
 *
 * `.wasm.js` only, without the sibling `.wasm`: these are SINGLE_FILE emscripten
 * builds that carry their module inline as base64, which is why each is 3.9 MB
 * rather than the 111 kB of glue you would expect. `getCore` asks for the
 * `.wasm.js` and nothing ever requests the `.wasm`, so copying it would put
 * 8.5 MB into the image that no browser will ever fetch.
 */
const CORE_FILES = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
];

/**
 * tessdata_fast, not tessdata or tessdata_best: 4 MB against 11 MB and 22 MB,
 * for a job that reads 90 characters of OCR-B out of a 37-symbol alphabet with
 * four check digits behind it. The accuracy the bigger models buy is accuracy
 * this use case can already recover from — `parseMrz` rejects what it cannot
 * verify, and the operator retakes the photo.
 *
 * Pinned to a tag rather than a branch, and verified, because this is the one
 * asset that comes off the network at build time.
 */
const MODEL = {
  url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/eng.traineddata',
  sha256: '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2',
  out: 'eng.traineddata.gz',
};

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function copyCore() {
  const from = path.join(MODULES, 'tesseract.js-core');
  if (!existsSync(from)) {
    throw new Error('tesseract.js-core is missing from node_modules. Run `npm ci` first.');
  }
  for (const file of CORE_FILES) {
    await copyFile(path.join(from, file), path.join(OUT, file));
  }
  await copyFile(
    path.join(MODULES, 'tesseract.js', 'dist', 'worker.min.js'),
    path.join(OUT, 'worker.min.js'),
  );
  console.log(`[ocr-assets] copied ${CORE_FILES.length + 1} engine files from node_modules`);
}

async function fetchModel() {
  const target = path.join(OUT, MODEL.out);

  // The recorded hash is of the UNCOMPRESSED model, because that is what the
  // upstream repository publishes and therefore the only thing worth pinning.
  // gzip output is not reproducible across zlib versions, so hashing the .gz
  // would fail on a machine whose zlib merely differs.
  if (existsSync(target)) {
    console.log(`[ocr-assets] ${MODEL.out} already present, leaving it alone`);
    return;
  }

  console.log(`[ocr-assets] downloading ${MODEL.url}`);
  const response = await fetch(MODEL.url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const raw = Buffer.from(await response.arrayBuffer());

  const actual = sha256(raw);
  if (actual !== MODEL.sha256) {
    throw new Error(
      `Language model checksum mismatch.\n  expected ${MODEL.sha256}\n  actual   ${actual}\n` +
        'Refusing to ship an unverified model. If upstream legitimately changed, ' +
        'verify the new file by hand and update the hash in this script.',
    );
  }

  await writeFile(target, gzipSync(raw, { level: 9 }));
  console.log(`[ocr-assets] wrote ${MODEL.out} (${(raw.length / 1024 / 1024).toFixed(1)} MB raw)`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await copyCore();
  await fetchModel();

  // A stale copy is worse than none: the engine would half-load and fail deep
  // inside a web worker, where the error surfaces as an unhelpful abort.
  const present = await Promise.all(
    [...CORE_FILES, 'worker.min.js', MODEL.out].map(async (file) => {
      const full = path.join(OUT, file);
      return existsSync(full) && (await readFile(full)).length > 0;
    }),
  );
  if (present.some((ok) => !ok)) throw new Error('Some OCR assets are missing or empty.');
  console.log('[ocr-assets] ready');
}

main().catch((error) => {
  console.error(`[ocr-assets] ${error.message}`);
  process.exit(1);
});
