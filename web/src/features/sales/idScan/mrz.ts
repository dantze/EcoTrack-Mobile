/**
 * Read a Romanian identity card's machine-readable zone (TODO-13).
 *
 * **Why the MRZ and not the card.** Autofilling `nume complet` and `CNP` looks
 * like an OCR problem, and as an OCR problem it is a bad one: the printed
 * fields are proportional type over a guilloche background, in a layout that
 * changed with the 2021 electronic card, with diacritics. The MRZ is the same
 * data in the one place designed to be read by a machine — three fixed 30-
 * character lines of OCR-B over a 37-symbol alphabet (`A-Z0-9<`), in the same
 * position on every ICAO 9303 TD1 document ever issued. Romania puts the CNP in
 * line 1's optional-data field, and the name is line 3. Both fields we want,
 * from the easiest 10% of the image.
 *
 * **Why this can be trusted to a free, imperfect OCR engine.** Not because the
 * engine is good — because the MRZ checks itself. Four ICAO check digits, the
 * CNP's own control digit, and the fact that the CNP restates the birth date
 * and sex that MRZ line 2 states independently. A misread has to survive all of
 * them to get through. So the rule this module implements is:
 *
 *   **autofill ONLY on a fully self-consistent read; otherwise refuse.**
 *
 * That is deliberately strict. A card whose document number smudged is rejected
 * even though we never use the document number, because a failed check digit
 * means *something* was misread and the parser cannot say what. The cost of
 * refusing is that the operator types two fields, which is what they do today.
 * The cost of a false accept is a wrong CNP written silently into a client
 * record — a field nobody re-reads, on a person, under GDPR. The costs are not
 * comparable, so this fails safe.
 *
 * `shared/id-mrz-cases.json` states that rule once and is read by this
 * project's test and by `mobile/utils/mrz.test.ts`. **The same parser exists at
 * `mobile/utils/mrz.ts`** — two projects, no shared code, no way to import each
 * other; the fixture is what pins that they still agree. Change the rule here
 * and the mobile suite fails, which is the point.
 *
 * Nothing in this file touches the network. That is the other half of the
 * design: see `ocr.ts` for why the image never leaves the device, and TODO-14
 * for why it is never stored.
 */

/** What a good read yields. Only `fullName` and `cnp` reach the form. */
export interface MrzRead {
  /** Nume then Prenume, title-cased. Transliterated — diacritics are gone. */
  fullName: string;
  /** 13 digits, or null on a document that carries none. */
  cnp: string | null;
  /** From MRZ line 2. Not stored; cross-checked against the CNP. */
  sex: 'M' | 'F' | null;
  /** ISO date decoded from the CNP, or null when the century is not encoded. */
  birthDate: string | null;
}

/**
 * Why a read was refused. These reach the user as distinct Romanian messages,
 * because they call for different actions: `format` means retake the photo,
 * `check-digit` means retake it more carefully, and the two `cnp-*` codes mean
 * the card was read but disagrees with itself.
 */
export type MrzRejection = 'format' | 'check-digit' | 'cnp-invalid' | 'cnp-mismatch';

export type MrzResult = { ok: true; read: MrzRead } | { ok: false; reason: MrzRejection };

const LINE_LENGTH = 30;

// ---------------------------------------------------------------------------
// ICAO 9303 check digits
// ---------------------------------------------------------------------------

const WEIGHTS = [7, 3, 1];

function charValue(char: string): number {
  if (char === '<') return 0;
  if (char >= '0' && char <= '9') return char.charCodeAt(0) - 48;
  return char.charCodeAt(0) - 55; // 'A' -> 10
}

/** ICAO 9303 modulo-10 with the repeating 7-3-1 weighting. */
export function checkDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i += 1) sum += charValue(field[i]) * WEIGHTS[i % 3];
  return sum % 10;
}

function digitMatches(field: string, expected: string): boolean {
  return expected >= '0' && expected <= '9' && checkDigit(field) === Number(expected);
}

// ---------------------------------------------------------------------------
// Normalisation and OCR repair
// ---------------------------------------------------------------------------

/**
 * The OCR-B confusion set, in the direction each is applied.
 *
 * These are only ever used in positions where the character class is fixed by
 * the spec, so a letter in a numeric field is not a guess about what was meant
 * — it is already known to be wrong, and mapping it can only improve matters.
 * Applying them anywhere else would corrupt correct data, which is why the
 * ranges below are explicit rather than a blanket pass over the line.
 */
const TO_DIGIT: Record<string, string> = {
  O: '0', Q: '0', D: '0', U: '0',
  I: '1', L: '1', J: '1',
  Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4',
};

const TO_ALPHA: Record<string, string> = {
  '0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '6': 'G', '7': 'T', '8': 'B',
};

/** Strip everything that is not MRZ alphabet, after folding the usual mis-scans of `<`. */
function cleanLine(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[«≪]/g, '<<')
    .replace(/[‹＜]/g, '<')
    .replace(/[^A-Z0-9<]/g, '');
}

function coerceRange(chars: string[], from: number, to: number, map: Record<string, string>): void {
  for (let i = from; i <= to && i < chars.length; i += 1) {
    const mapped = map[chars[i]];
    if (mapped) chars[i] = mapped;
  }
}

/**
 * Fix characters that are the wrong class for their position.
 *
 * Line 1's document number (positions 6-14) is deliberately left alone: it is
 * alphanumeric by spec, so there is no wrong class there and any "repair" would
 * be a guess. Its check digit catches what we cannot fix.
 */
function repair(lines: string[]): string[] {
  const [l1, l2, l3] = lines.map((line) => line.split(''));

  coerceRange(l1, 0, 4, TO_ALPHA); // document code + issuing state
  coerceRange(l1, 14, 14, TO_DIGIT); // document-number check digit
  // Optional data is a free field on a TD1 in general. It is the CNP only on a
  // Romanian card, so only a Romanian card earns the numeric coercion.
  if (l1.slice(2, 5).join('') === 'ROU') coerceRange(l1, 15, 27, TO_DIGIT);

  coerceRange(l2, 0, 6, TO_DIGIT); // birth date + its check digit
  coerceRange(l2, 8, 14, TO_DIGIT); // expiry date + its check digit
  coerceRange(l2, 15, 17, TO_ALPHA); // nationality
  coerceRange(l2, 29, 29, TO_DIGIT); // composite check digit

  coerceRange(l3, 0, LINE_LENGTH - 1, TO_ALPHA); // the name field is letters and `<`

  return [l1.join(''), l2.join(''), l3.join('')];
}

/**
 * Pick the MRZ triple out of whatever the OCR returned.
 *
 * An engine handed a photo of a whole card returns the printed text too, so
 * this filters to lines that survive cleanup at exactly 30 characters and then
 * looks for a run of three starting with a document code (`I`). Lines are NOT
 * padded back to 30: the trailing filler of line 2 is its composite check
 * digit, and inventing that would disable the one check meant to catch a
 * truncated read.
 */
function findMrzLines(text: string | string[]): string[] | null {
  const raw = Array.isArray(text) ? text : text.split(/\r?\n/);
  const candidates = raw.map(cleanLine).filter((line) => line.length === LINE_LENGTH);
  if (candidates.length < 3) return null;

  for (let i = 0; i + 2 < candidates.length; i += 1) {
    if (candidates[i].startsWith('I')) return candidates.slice(i, i + 3);
  }
  return candidates.slice(0, 3);
}

// ---------------------------------------------------------------------------
// CNP
// ---------------------------------------------------------------------------

const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

/** The Romanian control digit: weighted sum mod 11, with 10 folding to 1. */
export function cnpControlDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(first12[i]) * CNP_WEIGHTS[i];
  const remainder = sum % 11;
  return remainder === 10 ? 1 : remainder;
}

/** Century by sector digit. 7/8 (residents) and 9 (foreign citizens) do not encode one. */
const CENTURY: Record<string, number> = { '1': 1900, '2': 1900, '3': 1800, '4': 1800, '5': 2000, '6': 2000 };

const MALE_SECTORS = new Set(['1', '3', '5', '7']);
const FEMALE_SECTORS = new Set(['2', '4', '6', '8']);

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Whether 13 digits are a structurally valid CNP.
 *
 * Checks the control digit, the county code and that the embedded date is a
 * date that exists. It cannot tell you the CNP belongs to anyone — only that it
 * was not misread.
 */
export function isValidCnp(cnp: string): boolean {
  if (!/^\d{13}$/.test(cnp)) return false;
  if (cnp[0] === '0') return false;
  if (cnpControlDigit(cnp.slice(0, 12)) !== Number(cnp[12])) return false;

  const county = Number(cnp.slice(7, 9));
  const validCounty = (county >= 1 && county <= 46) || county === 51 || county === 52;
  if (!validCounty) return false;

  const century = CENTURY[cnp[0]];
  const year = (century ?? 1900) + Number(cnp.slice(1, 3));
  return isRealDate(year, Number(cnp.slice(3, 5)), Number(cnp.slice(5, 7)));
}

function cnpBirthDate(cnp: string): string | null {
  const century = CENTURY[cnp[0]];
  if (century === undefined) return null;
  const year = century + Number(cnp.slice(1, 3));
  return `${year}-${cnp.slice(3, 5)}-${cnp.slice(5, 7)}`;
}

// ---------------------------------------------------------------------------
// Name
// ---------------------------------------------------------------------------

function titleCase(word: string): string {
  return word
    .split('-')
    .map((part) => (part ? part[0] + part.slice(1).toLowerCase() : part))
    .join('-');
}

/** `POPESCU<<ION<ANDREI<<<` -> `Popescu Ion Andrei`. Primary identifier first, as the card reads. */
function parseName(line: string): string {
  const [primary = '', secondary = ''] = line.split('<<');
  const words = `${primary}<${secondary}`.split('<').filter(Boolean);
  return words.map(titleCase).join(' ');
}

// ---------------------------------------------------------------------------
// The parse
// ---------------------------------------------------------------------------

function readTriple(lines: string[]): MrzResult {
  const [l1, l2, l3] = lines;

  // Every ICAO check digit, before anything is extracted. Order matters only
  // for the message the user sees, not for the outcome.
  const documentNumber = l1.slice(5, 14);
  const birth = l2.slice(0, 6);
  const expiry = l2.slice(8, 14);
  if (!digitMatches(documentNumber, l1[14])) return { ok: false, reason: 'check-digit' };
  if (!digitMatches(birth, l2[6])) return { ok: false, reason: 'check-digit' };
  if (!digitMatches(expiry, l2[14])) return { ok: false, reason: 'check-digit' };

  const composite = l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  if (!digitMatches(composite, l2[29])) return { ok: false, reason: 'check-digit' };

  const fullName = parseName(l3);
  if (!fullName) return { ok: false, reason: 'format' };

  const sexChar = l2[7];
  const sex = sexChar === 'M' || sexChar === 'F' ? sexChar : null;

  // A TD1's optional data is a free field; on a Romanian card it is the CNP.
  // Absent (all filler) is a valid card, so the name still autofills.
  const optional = l1.slice(15, 30).replace(/</g, '');
  if (!optional) return { ok: true, read: { fullName, cnp: null, sex, birthDate: null } };

  if (!/^\d{13}$/.test(optional) || !isValidCnp(optional)) {
    return { ok: false, reason: 'cnp-invalid' };
  }

  // The cross-check the whole design rests on: the CNP restates, in its own
  // digits, what line 2 states separately. Both are YYMMDD, so this compares
  // without needing to resolve the century.
  if (optional.slice(1, 7) !== birth) return { ok: false, reason: 'cnp-mismatch' };
  const expectedSex = MALE_SECTORS.has(optional[0])
    ? 'M'
    : FEMALE_SECTORS.has(optional[0])
      ? 'F'
      : null;
  if (sex && expectedSex && sex !== expectedSex) return { ok: false, reason: 'cnp-mismatch' };

  return { ok: true, read: { fullName, cnp: optional, sex, birthDate: cnpBirthDate(optional) } };
}

/**
 * Parse OCR output into a form-fillable read, or say why it will not.
 *
 * Accepts either the raw text an engine returns or its lines. Tries the
 * class-repaired reading first and the untouched one second, so a card whose
 * optional-data field is genuinely alphanumeric is not failed by a repair meant
 * for Romanian cards.
 */
export function parseMrz(text: string | string[]): MrzResult {
  const lines = findMrzLines(text);
  if (!lines) return { ok: false, reason: 'format' };

  const attempts = [repair(lines), lines];
  let firstFailure: MrzResult = { ok: false, reason: 'format' };
  for (const [index, attempt] of attempts.entries()) {
    const result = readTriple(attempt);
    if (result.ok) return result;
    if (index === 0) firstFailure = result;
  }
  return firstFailure;
}
