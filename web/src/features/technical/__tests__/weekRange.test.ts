import { describe, expect, it, vi, afterEach } from 'vitest';
import { weekRange, weekStartIso } from '../utils';

/**
 * Weeks start on MONDAY — that is how the Romanian working week runs, and how
 * `Route.dayOfWeek` is numbered (1 = Monday, per java.time.DayOfWeek). Getting
 * this wrong would silently shift every "Săptămâna asta" filter by a day.
 */
describe('week ranges', () => {
  afterEach(() => vi.useRealTimers());

  function freeze(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${iso}T12:00:00`));
  }

  it('treats Monday as the first day of the week', () => {
    freeze('2026-05-06'); // a Wednesday
    expect(weekStartIso()).toBe('2026-05-04');
  });

  it('keeps Sunday in the week that started the previous Monday', () => {
    // The classic off-by-one: JS getDay() calls Sunday 0, which would otherwise
    // roll it forward into the next week.
    freeze('2026-05-10'); // a Sunday
    expect(weekStartIso()).toBe('2026-05-04');
  });

  it('returns an inclusive Monday→Sunday range for the current week', () => {
    freeze('2026-05-06');
    expect(weekRange(0)).toEqual({ from: '2026-05-04', to: '2026-05-10' });
  });

  it('returns the following week for offset 1', () => {
    freeze('2026-05-06');
    expect(weekRange(1)).toEqual({ from: '2026-05-11', to: '2026-05-17' });
  });

  it('crosses a month boundary without drifting', () => {
    freeze('2026-04-30'); // Thursday
    expect(weekRange(1)).toEqual({ from: '2026-05-04', to: '2026-05-10' });
  });
});
