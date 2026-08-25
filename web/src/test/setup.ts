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
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  // jsdom has no matchMedia; several UI components read it on mount.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
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

  // jsdom implements neither of these on HTMLElement.
  Element.prototype.scrollIntoView ??= vi.fn();
});
