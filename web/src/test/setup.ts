/**
 * Vitest setup — runs once per test file, before the file's imports execute.
 *
 * Kept deliberately small. Anything that silently changes app behaviour in
 * tests (auto-mocked modules, faked timers, a pre-populated store) makes the
 * suite lie about the real app, so the only things here are the jest-dom
 * matchers, automatic DOM cleanup, and stubs for two browser APIs jsdom does
 * not implement at all.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { resetConfirms } from '@/components/ui/feedback';
import { afterEach, beforeAll, vi } from 'vitest';

// `waitFor` and the `findBy*` queries default to 1000ms, and that budget is
// SEPARATE from Vitest's `testTimeout` — raising one does nothing for the
// other. One second is enough for a component test and not enough for the
// handful that boot the real router under the real provider stack: those were
// measured at ~4s for the first case in a file, and they flake when the whole
// suite runs in parallel on a loaded machine.
//
// Raised here rather than per call site so the next router test inherits it
// instead of rediscovering the same flake. It only bounds how long a query may
// WAIT for something that never arrives — a passing assertion still returns
// the moment the DOM settles, so this costs nothing when tests are healthy.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
  // The confirm queue is module-level (it has to be — `requestConfirm` is
  // called from outside React), so an unanswered question survives `cleanup()`
  // and the NEXT test renders with a modal already on screen, whose overlay
  // makes every control in it unclickable. Same category as unmounting the DOM.
  resetConfirms();
});

beforeAll(() => {
  // jsdom has no matchMedia, and several components branch on it — the
  // list/detail split, the calendar's grid-vs-agenda switch, the nav pane.
  //
  // A stub that answers `false` to everything is not neutral: it puts every
  // test on the narrowest layout, which is the one the assertions are least
  // often written against. So this one ANSWERS, against jsdom's own 1024px
  // viewport — `(min-width: 768px)` is true, `(max-width: 640px)` is false —
  // and a test that wants the phone layout can narrow `window.innerWidth`
  // before rendering.
  if (!window.matchMedia) {
    const evaluate = (query: string): boolean => {
      const width = window.innerWidth || 1024;
      const min = /\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)(px|em|rem)\s*\)/.exec(query);
      const max = /\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)(px|em|rem)\s*\)/.exec(query);
      const toPx = (value: string, unit: string) =>
        unit === 'px' ? Number(value) : Number(value) * 16;
      if (min && width < toPx(min[1]!, min[2]!)) return false;
      if (max && width > toPx(max[1]!, max[2]!)) return false;
      // Anything else — `prefers-color-scheme`, `pointer: coarse` — is the
      // default: a light-themed desktop with a mouse.
      return Boolean(min || max);
    };

    window.matchMedia = ((query: string) => ({
      matches: evaluate(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  // Neither ResizeObserver nor IntersectionObserver exists in jsdom. Real
  // implementations are irrelevant here — the components only need the
  // constructor not to throw.
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver;

  // jsdom implements none of these on HTMLElement. Radix (behind every shadcn
  // overlay) calls the pointer-capture trio while dragging a Select or Slider,
  // and cmdk scrolls the highlighted item into view on every arrow key. Absent,
  // they throw inside an event handler and the test fails somewhere unrelated.
  Element.prototype.scrollIntoView ??= vi.fn();
  Element.prototype.hasPointerCapture ??= (() => false) as Element['hasPointerCapture'];
  Element.prototype.setPointerCapture ??= vi.fn();
  Element.prototype.releasePointerCapture ??= vi.fn();

  window.scrollTo ??= vi.fn() as unknown as typeof window.scrollTo;
});

/**
 * Every render gets the app's real provider stack.
 *
 * Mantine controls (the date field), Radix tooltips and the toast host all
 * throw or misbehave without their providers, and the app never renders a
 * screen without them — so a test that mounts one bare is testing a
 * configuration that does not exist. Wrapping here rather than in ~30 test
 * files keeps that guarantee in one place, and a test that supplies its own
 * `wrapper` still gets it: the two compose, ours outermost.
 */
vi.mock('@testing-library/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@testing-library/react')>();
  const { AppProviders } = await import('@/theme/AppProviders');
  const { createElement } = await import('react');

  // Typed loosely on purpose: RTL's `render` is generic over its query set and
  // container, and reproducing that signature here buys nothing — the wrapper
  // is the only thing this override changes.
  const render = ((ui: Parameters<typeof actual.render>[0], options?: { wrapper?: React.ComponentType<{ children?: React.ReactNode }> }) => {
    const Inner = options?.wrapper;
    const Wrapper = ({ children }: { children?: React.ReactNode }) =>
      createElement(AppProviders, null, Inner ? createElement(Inner, null, children) : children);
    return actual.render(ui, { ...options, wrapper: Wrapper });
  }) as typeof actual.render;

  return { ...actual, render };
});
