/**
 * Read text off an ID photo without the photo ever leaving the browser (TODO-13).
 *
 * **This is also the answer to TODO-14.** That item asks how to stop the
 * developer reading stored ID photos; the cheapest and strongest answer is that
 * there is no stored ID photo. The image is decoded, recognised and dropped
 * inside this module — it is never uploaded, never persisted, and the only
 * thing that outlives the call is two strings the operator can see on screen
 * and edit before saving. A photo that was never taken off the device cannot
 * leak from a bucket, a backup, or a laptop.
 *
 * Holding that line has one non-obvious requirement: **the engine has to be
 * ours too.** tesseract.js defaults `workerPath`, `corePath` and `langPath` to
 * jsDelivr, and a page that loads its OCR worker from a CDN has put a third
 * party in the request path of an ID scan. Every path below is same-origin,
 * served out of `public/tesseract/` by `scripts/fetch-ocr-assets.mjs`. This is
 * the same rule the map obeys in the other direction — `src/lib/geocoding.ts`
 * keeps our bearer token off Photon's host; this keeps jsDelivr out of our
 * scanner.
 *
 * tesseract.js is ~4 MB of engine plus a 2 MB model, so **everything here is
 * behind a dynamic import** and the module is loaded only when someone actually
 * presses Scanează. Same discipline as maplibre, and for the same reason: the
 * eager bundle has a budget and this would eat it whole.
 */

import { parseMrz, type MrzResult } from './mrz';

/** Where `fetch-ocr-assets.mjs` puts the engine. Same origin, always. */
const ASSET_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/tesseract`;

/**
 * The MRZ alphabet, and nothing else.
 *
 * This is the single highest-value setting in the file. Unconstrained, the
 * engine offers `¢`, `§` and lowercase for a band that cannot contain them; with
 * the whitelist it has to pick from 37 symbols, which turns most misreads into
 * the O/0 and I/1 confusions that `repair()` in `mrz.ts` already undoes by
 * position.
 */
const MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

/** Wider than a card at any sane phone resolution; small enough to stay quick. */
const TARGET_WIDTH = 1600;

export interface ScanProgress {
  /** 0..1, for a progress bar. The engine reports load and recognise separately. */
  progress: number;
  /** A Romanian label for what is happening, for the operator. */
  label: string;
}

/**
 * Grayscale, upscale, and raise contrast before the engine sees the image.
 *
 * Phone photos of an ID are usually too small for OCR-B at the MRZ's point
 * size, and Tesseract does its own binarisation far better on a clean grayscale
 * ramp than on a JPEG's colour noise. Doing it here rather than passing the raw
 * File is the difference between reading the band and not.
 *
 * The canvas never leaves this function, and the ImageBitmap is closed after —
 * no object URL survives for something else to pick up.
 */
async function preprocess(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(3, Math.max(1, TARGET_WIDTH / bitmap.width));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      // Rec. 601 luma, then a gentle S-curve around mid grey. Anything harder
      // than this starts eating the thin strokes of OCR-B.
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const boosted = Math.max(0, Math.min(255, (luma - 128) * 1.4 + 128));
      data[i] = boosted;
      data[i + 1] = boosted;
      data[i + 2] = boosted;
    }
    context.putImageData(image, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob ?? file;
  } finally {
    bitmap.close();
  }
}

const STATUS_LABELS: Record<string, string> = {
  'loading tesseract core': 'Se pregătește scanarea…',
  'initializing tesseract': 'Se pregătește scanarea…',
  'loading language traineddata': 'Se încarcă modelul…',
  'initializing api': 'Se pregătește scanarea…',
  'recognizing text': 'Se citește buletinul…',
};

/**
 * Recognise an ID image and parse its MRZ.
 *
 * Resolves with the same discriminated result `parseMrz` returns — a refusal is
 * an ordinary outcome here, not an error, because a blurry photo is the common
 * case and the caller has a Romanian message for each reason. It rejects only
 * when the engine itself could not run.
 *
 * The worker is always terminated, including on failure: it holds the decoded
 * image, and leaving it alive would keep a copy of someone's ID in memory for
 * as long as the tab is open.
 */
export async function scanIdImage(
  file: Blob,
  onProgress?: (update: ScanProgress) => void,
): Promise<MrzResult> {
  const { createWorker, OEM, PSM } = await import('tesseract.js');

  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${ASSET_BASE}/worker.min.js`,
    corePath: ASSET_BASE,
    langPath: ASSET_BASE,
    gzip: true,
    logger: onProgress
      ? (message: { status: string; progress: number }) =>
          onProgress({
            progress: message.progress,
            label: STATUS_LABELS[message.status] ?? 'Se scanează…',
          })
      : undefined,
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist: MRZ_CHARS,
      // A single uniform block. The MRZ is not prose and the engine's layout
      // analysis has nothing useful to contribute; left to itself it splits the
      // three lines across columns and the triple is never adjacent.
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      // Phone photos carry no DPI, and without this the engine guesses 70 and
      // warns that the image is too small to recognise.
      user_defined_dpi: '300',
    });

    const prepared = await preprocess(file);
    const { data } = await worker.recognize(prepared);
    return parseMrz(data.text);
  } finally {
    await worker.terminate();
  }
}
