/**
 * The local usage log behind "the client I was just working on comes first".
 *
 * Two things matter here. The ranking has to actually prefer recent, repeated
 * use — otherwise the nudge is noise. And every read and write has to survive
 * a hostile `localStorage`: private windows, disabled site data and quota
 * errors are all normal, and none of them may take a screen down. The boost is
 * a nicety; losing it must cost nothing but alphabetical ordering.
 *
 * Each `it` re-imports the module so the singleton log starts empty.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Recents = typeof import('../recents');

async function freshModule(): Promise<Recents> {
  vi.resetModules();
  return import('../recents');
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('boost', () => {
  it('is zero for something never used', async () => {
    const { boost } = await freshModule();
    expect(boost('client', 42)).toBe(0);
  });

  it('grows with repeated use', async () => {
    const { boost, recordUse } = await freshModule();
    recordUse('client', 1);
    const once = boost('client', 1);
    recordUse('client', 1);
    recordUse('client', 1);
    expect(boost('client', 1)).toBeGreaterThan(once);
  });

  it('decays with age, so yesterday beats last quarter', async () => {
    vi.useFakeTimers();
    const { boost, recordUse } = await freshModule();

    vi.setSystemTime(new Date('2026-01-01T09:00:00Z'));
    recordUse('client', 1);
    recordUse('client', 1);
    recordUse('client', 1);
    recordUse('client', 1);

    vi.setSystemTime(new Date('2026-04-01T09:00:00Z')); // ~90 days later
    recordUse('client', 2);

    expect(boost('client', 2)).toBeGreaterThan(boost('client', 1));
  });

  it('is bounded, so a favourite can never outrank an exact-name match', async () => {
    const { boost, recordUse } = await freshModule();
    for (let index = 0; index < 500; index += 1) recordUse('client', 1);
    expect(boost('client', 1)).toBeLessThanOrEqual(260);
  });

  it('keeps kinds apart', async () => {
    const { boost, recordUse } = await freshModule();
    recordUse('client', 7);
    expect(boost('route', 7)).toBe(0);
  });
});

describe('recentIds', () => {
  it('lists the most recently used ids of one kind, newest first', async () => {
    const { recentIds, recordUse } = await freshModule();
    recordUse('order', 1);
    recordUse('order', 2);
    recordUse('route', 3);
    recordUse('order', 1);

    expect(recentIds('order')).toEqual(['1', '2']);
    expect(recentIds('route')).toEqual(['3']);
  });

  it('honours the limit', async () => {
    const { recentIds, recordUse } = await freshModule();
    for (const id of [1, 2, 3, 4, 5]) recordUse('task', id);
    expect(recentIds('task', 2)).toHaveLength(2);
  });
});

describe('persistence', () => {
  it('reads back a log written by an earlier session', async () => {
    const first = await freshModule();
    first.recordUse('client', 99);

    const second = await freshModule();
    expect(second.boost('client', 99)).toBeGreaterThan(0);
  });

  it('ignores a corrupt stored value instead of throwing', async () => {
    window.localStorage.setItem('ecotrack:recents:v1', '{ not json');
    const { boost, recordUse } = await freshModule();
    expect(() => recordUse('client', 1)).not.toThrow();
    expect(boost('client', 1)).toBeGreaterThan(0);
  });

  it('drops entries of the wrong shape', async () => {
    window.localStorage.setItem(
      'ecotrack:recents:v1',
      JSON.stringify([{ key: 'client:1' }, { nope: true }, { key: 'client:2', count: 1, last: Date.now() }]),
    );
    const { boost } = await freshModule();
    expect(boost('client', 1)).toBe(0);
    expect(boost('client', 2)).toBeGreaterThan(0);
  });

  it('survives a storage that refuses to write (private mode, quota)', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

    const { boost, recordUse } = await freshModule();
    expect(() => recordUse('client', 5)).not.toThrow();
    // Still ranks for the rest of this session, just not across a reload.
    expect(boost('client', 5)).toBeGreaterThan(0);
    expect(setItem).toHaveBeenCalled();
  });

  it('survives a storage that refuses to read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { boost } = await freshModule();
    expect(boost('client', 1)).toBe(0);
  });
});

describe('subscribeRecents', () => {
  it('notifies listeners on write and stops after unsubscribing', async () => {
    const { recordUse, subscribeRecents, recentsRevision } = await freshModule();
    const listener = vi.fn();
    const unsubscribe = subscribeRecents(listener);

    const before = recentsRevision();
    recordUse('client', 1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(recentsRevision()).not.toBe(before);

    unsubscribe();
    recordUse('client', 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
