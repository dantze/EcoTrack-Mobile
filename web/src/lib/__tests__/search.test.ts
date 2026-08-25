/**
 * Local search primitives.
 *
 * Two properties are load-bearing and easy to break by "simplifying":
 *
 *   1. Romanian folding. Operators type without diacritics — "stefan",
 *      "bucuresti", "targoviste" — and every search box in the app has to find
 *      "Ștefan", "București", "Târgoviște" anyway. A naive `toLowerCase()`
 *      does not, which is exactly the bug this file guards.
 *   2. Index alignment. `foldAligned` must emit one character per input
 *      character, because match ranges computed on the folded string are used
 *      to highlight the ORIGINAL string. If folding ever changes the length,
 *      highlights silently land on the wrong letters.
 */

import { describe, expect, it } from 'vitest';
import {
  fold,
  foldAligned,
  fuzzyMatch,
  fuzzyMatchFields,
  includesFolded,
  rankBy,
  splitHighlight,
} from '../search';

describe('folding', () => {
  it.each([
    ['Ștefan', 'stefan'],
    ['București', 'bucuresti'],
    ['Târgoviște', 'targoviste'],
    ['Așezare Nouă', 'asezare noua'],
    ['Toaletă ecologică', 'toaleta ecologica'],
  ])('folds %s to %s', (input, expected) => {
    expect(fold(input)).toBe(expected);
    expect(foldAligned(input)).toBe(expected);
  });

  it('preserves length, so ranges map back onto the original', () => {
    for (const value of ['Ștefan Popescu', 'Str. Ștefan cel Mare nr. 12, Târgoviște', 'ĂÂÎȘȚ']) {
      expect(foldAligned(value)).toHaveLength(value.length);
    }
  });

  it('leaves text without diacritics alone apart from case', () => {
    expect(foldAligned('Ion MARINESCU')).toBe('ion marinescu');
  });
});

describe('includesFolded', () => {
  it('matches across diacritics in both directions', () => {
    expect(includesFolded('Ștefan Popescu', 'stefan')).toBe(true);
    expect(includesFolded('Stefan Popescu', 'Ștefan')).toBe(true);
    expect(includesFolded('Str. X nr. 2, București', 'bucuresti')).toBe(true);
  });

  it('is true for an empty needle and false for a genuine miss', () => {
    expect(includesFolded('Ana', '   ')).toBe(true);
    expect(includesFolded('Ana', 'zzz')).toBe(false);
  });
});

describe('fuzzyMatch', () => {
  it('reports ranges that select the matched text in the ORIGINAL string', () => {
    const source = 'Ștefan Popescu';
    const match = fuzzyMatch(source, 'stefan');
    expect(match).not.toBeNull();
    const [range] = match!.ranges;
    expect(source.slice(range!.start, range!.end)).toBe('Ștefan');
  });

  it('requires every whitespace-separated term, in any order', () => {
    expect(fuzzyMatch('Popescu Ștefan · București', 'stef bucur')).not.toBeNull();
    expect(fuzzyMatch('Popescu Ștefan · București', 'stef cluj')).toBeNull();
  });

  it('falls back to a subsequence when there is no substring', () => {
    expect(fuzzyMatch('Toaletă ecologică standard', 'tstd')).not.toBeNull();
    expect(fuzzyMatch('Toaletă ecologică standard', 'zzz')).toBeNull();
  });

  it('scores a prefix above a word start above a mid-word hit', () => {
    const prefix = fuzzyMatch('Ion Marinescu', 'ion')!.score;
    const wordStart = fuzzyMatch('Ana Ionescu', 'ion')!.score;
    const midWord = fuzzyMatch('Marion Vasile', 'ion')!.score;
    expect(prefix).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(midWord);
  });
});

describe('fuzzyMatchFields', () => {
  it('prefers a hit on the first field over the same hit further down', () => {
    const onName = fuzzyMatchFields(['Ana Pop', '0721000000'], 'ana')!;
    const onPhone = fuzzyMatchFields(['Zorel Ionescu', 'ana@example.ro'], 'ana')!;
    expect(onName.score).toBeGreaterThan(onPhone.score);
  });

  it('only highlights the primary field, so secondary hits do not mis-mark', () => {
    expect(fuzzyMatchFields(['Zorel Ionescu', 'ana@example.ro'], 'ana')!.ranges).toEqual([]);
  });

  it('skips null and empty fields instead of throwing', () => {
    expect(fuzzyMatchFields([null, undefined, ''], 'ana')).toBeNull();
  });
});

describe('rankBy', () => {
  const clients = [
    { name: 'Ana Ionescu' },
    { name: 'Ionescu Andrei' },
    { name: 'Ion Marinescu' },
    { name: 'Vasile Popa' },
  ];

  it('drops non-matches and sorts by relevance', () => {
    const names = rankBy(clients, 'ion', (client) => [client.name]).map(
      (result) => result.item.name,
    );
    expect(names).not.toContain('Vasile Popa');
    expect(names[0]).toBe('Ion Marinescu');
  });

  it('lets a boost lift a weaker match — the recency nudge', () => {
    const boosted = rankBy(clients, 'ion', (client) => [client.name], {
      boost: (client) => (client.name === 'Ana Ionescu' ? 500 : 0),
    });
    expect(boosted[0]!.item.name).toBe('Ana Ionescu');
  });

  it('honours the limit', () => {
    expect(rankBy(clients, 'ion', (client) => [client.name], { limit: 2 })).toHaveLength(2);
  });
});

describe('splitHighlight', () => {
  it('splits into matched and unmatched chunks that rejoin to the source', () => {
    const parts = splitHighlight('Ana Ionescu', [{ start: 4, end: 7 }]);
    expect(parts.map((part) => part.text).join('')).toBe('Ana Ionescu');
    expect(parts.filter((part) => part.hit).map((part) => part.text)).toEqual(['Ion']);
  });

  it('returns the whole string unmatched when there are no ranges', () => {
    expect(splitHighlight('Ana', [])).toEqual([{ text: 'Ana', hit: false }]);
  });
});
