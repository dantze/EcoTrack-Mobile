import TextRecognition from '@react-native-ml-kit/text-recognition';
import { parseMrz, type MrzRejection, type MrzResult } from '../utils/mrz';

/**
 * Read an identity card with the phone's own text recogniser (TODO-13).
 *
 * **The photo never leaves the phone, and is never stored** (TODO-14). ML Kit's
 * Latin recogniser is an on-device model that ships inside the app; recognition
 * is a local call, there is no API key and no request. The image the operator
 * just took is handed to it, the two fields come back, and the file is dropped.
 * This is the whole answer to "the developer must not be able to read stored ID
 * photos": there is no stored ID photo. `PhotoService.uploadIdPhoto` and the
 * `/{clientId}/idPhoto` endpoints it called are gone.
 *
 * It is also free, which was the constraint. Nothing here bills per scan.
 *
 * **This is a native module, so it does not ship over the air.** `eas update`
 * cannot deliver it — an installed build without the ML Kit binary will throw
 * the linking error the moment someone presses Scanează. Hence
 * {@link isIdScanAvailable}: the button is hidden on a build that cannot do
 * this, rather than offering a feature that fails on touch. See DEPLOYMENT.md.
 *
 * The MRZ parsing itself is in `utils/mrz.ts` — pure, shared in spirit with the
 * web app, and pinned against it by `shared/id-mrz-cases.json`.
 */

export type { MrzRead, MrzRejection, MrzResult } from '../utils/mrz';

/**
 * Whether this build actually carries the recogniser.
 *
 * The package throws its linking error from a Proxy on first property access,
 * so the only way to ask is to touch it and catch. Called once at render time
 * to decide whether to show the button at all.
 */
export function isIdScanAvailable(): boolean {
    try {
        return typeof TextRecognition.recognize === 'function';
    } catch {
        return false;
    }
}

/**
 * Every line ML Kit found, as separate strings.
 *
 * `result.text` is the blocks joined with newlines, which is usually the same
 * thing — but a card photographed at an angle can put the three MRZ rows in
 * three different blocks, and then the joined text has them adjacent while a
 * block's own `text` does not. Collecting both and letting `parseMrz` pick the
 * triple costs nothing: it filters to lines that clean up to exactly 30
 * characters, so anything else is discarded on the way in.
 */
function lines(result: { text: string; blocks: { lines: { text: string }[] }[] }): string[] {
    const fromBlocks = result.blocks.flatMap((block) => block.lines.map((line) => line.text));
    return [...result.text.split('\n'), ...fromBlocks];
}

/**
 * Recognise an ID photo and parse its MRZ.
 *
 * A refusal is an ordinary outcome, not an error — a blurry photo is the common
 * case, and the caller has a Romanian message for each reason. This rejects
 * only when the recogniser itself could not run, which on a correctly built app
 * should not happen; {@link isIdScanAvailable} is what keeps the button off the
 * builds where it would.
 *
 * @param uri local file URI from ImagePicker. Not uploaded anywhere.
 */
export async function scanIdImage(uri: string): Promise<MrzResult> {
    const result = await TextRecognition.recognize(uri);
    return parseMrz(lines(result));
}

/**
 * Why a read was refused, in terms of what the operator should do next.
 *
 * The two `cnp-*` reasons mean the card WAS read and disagrees with itself, so
 * another photo of the same card fails identically — those say "type it"
 * instead of "try again". Kept in step with the web app's
 * `features/sales/idScan/IdScanField.tsx`.
 */
export const ID_SCAN_REFUSALS: Record<MrzRejection, string> = {
    format:
        'Nu am găsit zona citibilă automat — cele trei rânduri de litere și simboluri „<” de la baza actului. Fotografiați actul întreg, drept și bine luminat.',
    'check-digit':
        'Rândurile de la baza actului au fost citite greșit. Încercați o fotografie mai clară, fără reflexii și fără umbre.',
    'cnp-invalid': 'CNP-ul citit nu trece verificarea cifrei de control. Introduceți datele manual.',
    'cnp-mismatch':
        'Datele citite nu se potrivesc între ele (CNP-ul contrazice data nașterii de pe act). Introduceți datele manual.',
};
