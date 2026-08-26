import { describe, it, expect } from 'vitest';
import { insertAtSlot, moveToSlot, readSlotIndex, slotId } from '../components/placement';

/**
 * The insertion bands index positions in the list as it currently stands, so
 * moving a stop *down* has to account for the stop lifting out from above the
 * target. That off-by-one is the difference between "drag one place down" and
 * "drag does nothing".
 */
describe('moveToSlot', () => {
  const ids = [10, 20, 30, 40];

  it('moves a stop down, accounting for the lift-out', () => {
    // Band 2 sits between 20 and 30. Moving 10 there must land it after 20.
    expect(moveToSlot(ids, 0, 2)).toEqual([20, 10, 30, 40]);
  });

  it('moves a stop up without adjustment', () => {
    expect(moveToSlot(ids, 3, 1)).toEqual([10, 40, 20, 30]);
  });

  it('moves a stop to the very end', () => {
    expect(moveToSlot(ids, 0, 4)).toEqual([20, 30, 40, 10]);
  });

  it('moves a stop to the very front', () => {
    expect(moveToSlot(ids, 2, 0)).toEqual([30, 10, 20, 40]);
  });

  it('is a no-op for the band directly above the stop', () => {
    expect(moveToSlot(ids, 1, 1)).toEqual(ids);
  });

  it('is a no-op for the band directly below the stop', () => {
    // Band 2 is immediately after stop 1 — lifting it out puts it right back.
    expect(moveToSlot(ids, 1, 2)).toEqual(ids);
  });

  it('returns a copy, never the original array', () => {
    const result = moveToSlot(ids, 1, 1);
    expect(result).not.toBe(ids);
  });

  it('tolerates an out-of-range source instead of corrupting the list', () => {
    expect(moveToSlot(ids, 9, 0)).toEqual(ids);
    expect(moveToSlot(ids, -1, 0)).toEqual(ids);
  });

  it('clamps a band beyond the end', () => {
    expect(moveToSlot(ids, 0, 99)).toEqual([20, 30, 40, 10]);
  });

  it('handles a single-item list', () => {
    expect(moveToSlot([7], 0, 1)).toEqual([7]);
  });
});

describe('insertAtSlot', () => {
  it('inserts a batch in pick-up order', () => {
    expect(insertAtSlot([1, 2, 3], [8, 9], 1)).toEqual([1, 8, 9, 2, 3]);
  });

  it('appends at the trailing band', () => {
    expect(insertAtSlot([1, 2], [5], 2)).toEqual([1, 2, 5]);
  });

  it('prepends at band 0', () => {
    expect(insertAtSlot([1, 2], [5], 0)).toEqual([5, 1, 2]);
  });

  it('clamps out-of-range bands rather than producing holes', () => {
    expect(insertAtSlot([1, 2], [5], 99)).toEqual([1, 2, 5]);
    expect(insertAtSlot([1, 2], [5], -3)).toEqual([5, 1, 2]);
  });

  it('handles an empty route', () => {
    expect(insertAtSlot([], [4, 5], 0)).toEqual([4, 5]);
  });
});

describe('slot ids', () => {
  it('round-trips', () => {
    expect(readSlotIndex(slotId(0))).toBe(0);
    expect(readSlotIndex(slotId(12))).toBe(12);
  });

  it('rejects anything that is not a slot id', () => {
    // Route stops use raw numeric ids and the pool uses `pool-<id>`; neither
    // may ever be mistaken for an insertion band.
    expect(readSlotIndex(4)).toBeNull();
    expect(readSlotIndex('pool-4')).toBeNull();
    expect(readSlotIndex('route-drop-zone')).toBeNull();
    expect(readSlotIndex('slot-abc')).toBeNull();
    expect(readSlotIndex('slot--1')).toBeNull();
    expect(readSlotIndex(undefined)).toBeNull();
  });
});
