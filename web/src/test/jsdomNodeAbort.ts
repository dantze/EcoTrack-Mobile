/**
 * The jsdom environment, with one seam repaired: signals crossing from jsdom
 * into Node's `fetch` (TODO-48).
 *
 * THE BUG THIS EXISTS FOR. jsdom ships its own `AbortController`/`AbortSignal`
 * and Vitest's jsdom environment copies them onto the global, shadowing Node's.
 * jsdom has no `fetch`, though, so `fetch` and `Request` stay Node's — and
 * undici brand-checks the signal it is handed against the `AbortSignal` class
 * it captured at bootstrap, which is the one jsdom just replaced. React
 * Router's `createBrowserRouter` builds `new Request(url, { signal })` from a
 * global `AbortController` on its very first navigation, so every test that
 * boots the real router died with:
 *
 *   TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an
 *   instance of AbortSignal.
 *
 * That was 11 tests across `bootNavigation.test.tsx` and `screensSmoke.test.tsx`
 * — every test in the suite that mounts the router.
 *
 * WHY IT ONLY BIT ON NODE 24. The brand check is not new; Node 24's undici
 * applies it to `RequestInit.signal` where earlier versions were laxer. CI pins
 * Node 22 (`.nvmrc`, `ci-web.yml`), so the suite was green there and red for
 * anyone who had upgraded — the worst kind of split, because it makes "do the
 * tests pass" depend on who is asking.
 *
 * WHY A BRIDGE AND NOT A SWAP. The obvious fix is to put Node's classes back on
 * the global after jsdom's setup. It was tried, and it trades one broken
 * direction for another: jsdom's `EventTarget.addEventListener` webidl-checks
 * `options.signal` against ITS AbortSignal and throws
 *
 *   TypeError: parameter 3 dictionary has member 'signal' that is not of type
 *   'AbortSignal'
 *
 * on a Node one — and React and Radix pass `{ signal }` to `addEventListener`
 * constantly, so that breaks far more than it fixes. Each side is right about
 * its own class. So both keep theirs, and the ONE crossing point between them
 * is translated here.
 *
 * The translation is a real link, not a cast: aborting the jsdom signal aborts
 * the Node one, with the same reason, so a cancelled navigation still cancels
 * its request. An already-aborted signal is handled up front, because
 * subscribing to `abort` after the fact would never fire.
 *
 * This is deliberately the only thing this environment changes. Everything else
 * is Vitest's stock jsdom.
 */

import { builtinEnvironments, type Environment } from 'vitest/environments';

export default <Environment>{
  name: 'jsdom-node-abort',
  transformMode: 'web',

  async setup(global, options) {
    // Captured BEFORE jsdom's setup, the only moment these are still Node's.
    const NodeAbortController = global.AbortController;
    const NodeAbortSignal = global.AbortSignal;
    const NodeRequest: typeof Request = global.Request;
    const nodeFetch: typeof fetch = global.fetch;

    const { teardown } = await builtinEnvironments.jsdom.setup(global, options);

    // Nothing is restored on the global: jsdom's AbortController/AbortSignal
    // stay, because the DOM is their consumer and it checks.
    if (!NodeRequest || !nodeFetch || !NodeAbortController) return { teardown };

    const toNodeSignal = (signal: AbortSignal | null | undefined) => {
      if (!signal || signal instanceof NodeAbortSignal) return signal;

      const controller = new NodeAbortController();
      if (signal.aborted) {
        controller.abort((signal as AbortSignal & { reason?: unknown }).reason);
      } else {
        signal.addEventListener(
          'abort',
          () => controller.abort((signal as AbortSignal & { reason?: unknown }).reason),
          { once: true },
        );
      }
      return controller.signal;
    };

    const bridgeInit = <T extends { signal?: AbortSignal | null }>(init: T | undefined) =>
      init && init.signal ? { ...init, signal: toNodeSignal(init.signal) } : init;

    // A subclass rather than a wrapper function, so `instanceof Request` still
    // answers true for anything holding the global.
    class BridgedRequest extends NodeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(input, bridgeInit(init));
      }
    }

    global.Request = BridgedRequest;
    global.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      nodeFetch(input, bridgeInit(init))) as typeof fetch;

    // jsdom's window is a separate object from the global here, and a library
    // may reach for either spelling. Which one it picks must not decide whether
    // the request works.
    if (global.window) {
      global.window.Request = global.Request;
      global.window.fetch = global.fetch;
    }

    return { teardown };
  },
};
