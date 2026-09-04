/**
 * Pins the seam repaired by `src/test/jsdomNodeAbort.ts` (TODO-48).
 *
 * Without it, two things are true at once and neither is obvious from a stack
 * trace: `fetch`/`Request` come from Node and brand-check signals against
 * Node's `AbortSignal`, while `addEventListener({ signal })` comes from jsdom
 * and brand-checks against jsdom's. Satisfy one naively and you break the
 * other — which is exactly what the first attempted fix did.
 *
 * So both directions are asserted here. If someone simplifies the environment
 * back to plain `'jsdom'`, or "tidies" it by swapping the globals instead of
 * bridging, one of these fails immediately with a clear reason — rather than 11
 * router tests failing somewhere else with a webidl error.
 */

import { describe, expect, it } from 'vitest';

describe('the jsdom/Node AbortSignal seam', () => {
  it('lets a global AbortSignal reach Node fetch, which react-router needs', () => {
    // Precisely what react-router's createClientSideRequest does on its first
    // navigation, and what used to throw:
    //   RequestInit: Expected signal (...) to be an instance of AbortSignal
    const controller = new AbortController();
    expect(() => new Request('http://example.test/', { signal: controller.signal })).not.toThrow();
  });

  it('still lets a global AbortSignal reach jsdom addEventListener', () => {
    // The direction the naive fix broke. React and Radix both remove listeners
    // this way, so a regression here is not a corner case.
    const controller = new AbortController();
    let calls = 0;
    const target = document.createElement('div');

    expect(() =>
      target.addEventListener('ecotrack:probe', () => { calls += 1; }, { signal: controller.signal }),
    ).not.toThrow();

    target.dispatchEvent(new Event('ecotrack:probe'));
    controller.abort();
    target.dispatchEvent(new Event('ecotrack:probe'));

    // Fired once, then aborting the signal removed the listener.
    expect(calls).toBe(1);
  });

  it('carries an abort across the bridge rather than dropping it', () => {
    // The bridge hands undici a DIFFERENT signal object than the caller made,
    // so the link between them has to be real: a cancelled navigation must
    // still cancel its request. A cast would pass the test above and fail here.
    const controller = new AbortController();
    const request = new Request('http://example.test/', { signal: controller.signal });

    expect(request.signal.aborted).toBe(false);
    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });

  it('handles a signal that was already aborted before the request was built', () => {
    // Subscribing to `abort` after the fact would never fire, so this case is
    // handled up front in the bridge.
    const controller = new AbortController();
    controller.abort();

    const request = new Request('http://example.test/', { signal: controller.signal });
    expect(request.signal.aborted).toBe(true);
  });
});
