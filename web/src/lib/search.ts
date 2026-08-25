/**
 * Local text matching and ranking.
 *
 * Everything "smart" in this app is deterministic computation over data the
 * client already holds — there is no service behind any of it. This module is
 * the bottom layer: fold Romanian text so a typed "stefan" finds "Ștefan",
 * score a candidate against a query, and report which characters matched so a
 * list can highlight them.
 *
 * Two folds, deliberately:
 *   `fold`        — cheap, for plain "does it contain this" tests.
 *   `foldAligned` — one output char per input char, so an index into the
 *                   folded string is also an index into the original and the
 *                   highlight ranges land on the right letters.
 */

const COMBINING = /[\u0300-\u036f]/g;

/** Lowercase, diacritics stripped. Indices are NOT preserved. */
export function fold(value: string): string {
  return value.normalize('NFD').replace(COMBINING, '').toLowerCase();
}

/**
 * Same folding, but length-preserving: "Ștefan" → "stefan" with every
 * character still at its original offset, which is what highlight ranges need.
 */
export function foldAligned(value: string): string {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    const source = value[index]!;
    const stripped = source.normalize('NFD').replace(COMBINING, '');
    const lowered = (stripped[0] ?? source).toLowerCase();
    out += lowered.length === 1 ? lowered : (lowered[0] ?? source);
  }
  return out;
}

/** Diacritic-insensitive "contains". */
export function includesFolded(haystack: string, needle: string): boolean {
  const trimmed = needle.trim();
  if (!trimmed) return true;
  return foldAligned(haystack).includes(foldAligned(trimmed));
}

export interface MatchRange {
  start: number;
  /** Exclusive. */
  end: number;
}

export interface MatchResult {
  /** Higher is better. Only comparable between candidates for the same query. */
  score: number;
  /** Character ranges in the ORIGINAL text, ascending and non-overlapping. */
  ranges: MatchRange[];
}

const SCORE_EXACT = 1200;
const SCORE_PREFIX = 900;
const SCORE_WORD_START = 750;
const SCORE_SUBSTRING = 560;
const SCORE_SUBSEQUENCE = 220;

function isBoundary(text: string, index: number): boolean {
  if (index === 0) return true;
  return !/[a-z0-9]/.test(text[index - 1]!);
}

/**
 * Scores one query term against one folded text. Returns null when the term
 * is not present at all — every term of a query must match for the candidate
 * to survive.
 */
function scoreTerm(folded: string, term: string): MatchResult | null {
  if (folded === term) {
    return { score: SCORE_EXACT, ranges: [{ start: 0, end: term.length }] };
  }

  const at = folded.indexOf(term);
  if (at >= 0) {
    const base =
      at === 0 ? SCORE_PREFIX : isBoundary(folded, at) ? SCORE_WORD_START : SCORE_SUBSTRING;
    return { score: base + term.length * 4, ranges: [{ start: at, end: at + term.length }] };
  }

  // Subsequence fallback: "tec std" still finds "Toaletă ecologică standard".
  const ranges: MatchRange[] = [];
  let cursor = 0;
  let bonus = 0;
  let previousIndex = -2;

  for (const char of term) {
    const found = folded.indexOf(char, cursor);
    if (found < 0) return null;
    if (found === previousIndex + 1) bonus += 14; // contiguous run
    if (isBoundary(folded, found)) bonus += 10; // start of a word
    const last = ranges[ranges.length - 1];
    if (last && last.end === found) last.end = found + 1;
    else ranges.push({ start: found, end: found + 1 });
    previousIndex = found;
    cursor = found + 1;
  }

  return { score: SCORE_SUBSEQUENCE + bonus, ranges };
}

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged: MatchRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/**
 * Scores `text` against `query`. Whitespace splits the query into terms that
 * must ALL match, in any order — "pop bucur" finds "Popescu · București".
 * Returns null when the text does not match.
 */
export function fuzzyMatch(text: string, query: string): MatchResult | null {
  const terms = foldAligned(query).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { score: 0, ranges: [] };

  const folded = foldAligned(text);
  let total = 0;
  const ranges: MatchRange[] = [];

  for (const term of terms) {
    const hit = scoreTerm(folded, term);
    if (!hit) return null;
    total += hit.score;
    ranges.push(...hit.ranges);
  }

  // Shorter labels win ties: matching "Ana" in "Ana" beats it in "Ana Maria…".
  return { score: total - Math.min(folded.length, 120) * 0.6, ranges: mergeRanges(ranges) };
}

/**
 * Best match across several fields — the first field is the label the caller
 * will highlight, the rest are searchable but scored at a discount so a hit on
 * the name always outranks a hit on a phone number.
 */
export function fuzzyMatchFields(
  fields: (string | null | undefined)[],
  query: string,
): MatchResult | null {
  let best: MatchResult | null = null;
  for (let index = 0; index < fields.length; index += 1) {
    const value = fields[index];
    if (!value) continue;
    const hit = fuzzyMatch(value, query);
    if (!hit) continue;
    const penalised = index === 0 ? hit : { score: hit.score - 150 * index, ranges: [] };
    if (!best || penalised.score > best.score) best = penalised;
  }
  return best;
}

export interface Ranked<T> {
  item: T;
  score: number;
  ranges: MatchRange[];
}

/**
 * Filters and sorts `items` by how well they match `query`.
 * `boost` adds a caller-supplied bonus (see lib/recents) so a record the
 * operator touches every day floats to the top of an ambiguous query.
 */
export function rankBy<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => (string | null | undefined)[],
  options: { boost?: (item: T) => number; limit?: number } = {},
): Ranked<T>[] {
  const { boost, limit } = options;
  const ranked: Ranked<T>[] = [];

  for (const item of items) {
    const hit = fuzzyMatchFields(fields(item), query);
    if (!hit) continue;
    ranked.push({ item, score: hit.score + (boost?.(item) ?? 0), ranges: hit.ranges });
  }

  ranked.sort((left, right) => right.score - left.score);
  return limit === undefined ? ranked : ranked.slice(0, limit);
}

/** Splits `text` into matched / unmatched chunks for highlight rendering. */
export function splitHighlight(
  text: string,
  ranges: MatchRange[],
): { text: string; hit: boolean }[] {
  if (ranges.length === 0) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), hit: false });
    parts.push({ text: text.slice(range.start, range.end), hit: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}
