/**
 * Shared internals for the UI kit: class helpers, the focus-ring vocabulary,
 * and the hooks the overlays need (focus trap, scroll lock, outside click).
 *
 * Nothing here is domain-aware; it is all generic desktop-app plumbing.
 */

import { useCallback, useEffect, useId, useRef } from 'react';
import { fold } from '@/lib/search';

export type ClassValue = string | false | null | undefined;

export const cx = (...parts: ClassValue[]) => parts.filter(Boolean).join(' ');

/**
 * Keyboard-only focus ring. Tailwind v4 `outline-*` utilities give us a ring
 * that sits outside the element without the offset-colour dance `ring-*`
 * needs — important inside table cells where there is no room to spare.
 *
 * Uses `brand-400`, not `brand-500`: Button/IconButton render on both the
 * white content area and the dark `brand-700` sidebar, and `brand-500` drops
 * to ~2.1:1 against that sidebar (fails the 3:1 non-text contrast minimum).
 * `brand-400` clears 3:1 against both ends — white (3.8:1) and the sidebar
 * (3.9–4.7:1).
 */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400';

/** Same idea, but hugging the element (used inside dense rows and menus). */
export const FOCUS_RING_TIGHT =
  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500';

/** Text-input chrome shared by TextInput / TextArea / Select / DateInput. */
export const CONTROL_BASE =
  'w-full rounded-md border bg-white text-sm text-ink transition-[color,box-shadow,border-color] ' +
  'placeholder:text-ink-subtle focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle';

export const CONTROL_IDLE =
  'border-border hover:border-border-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25';

export const CONTROL_ERROR =
  'border-danger-500 hover:border-danger-600 focus:border-danger-600 focus:ring-2 focus:ring-danger-500/25';

export const CONTROL_HEIGHT: Record<'sm' | 'md', string> = {
  sm: 'h-7 px-2',
  md: 'h-8 px-2.5',
};

export function controlClass(error: boolean, size: 'sm' | 'md' = 'md', extra?: ClassValue) {
  return cx(CONTROL_BASE, CONTROL_HEIGHT[size], error ? CONTROL_ERROR : CONTROL_IDLE, extra);
}

/** Stable ids for a labelled control plus its hint / error descriptions. */
export function useFieldIds(explicitId?: string) {
  const auto = useId();
  const id = explicitId ?? auto;
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
}

/**
 * Traps Tab inside `ref` while `active`, moves focus in on open, and returns it
 * to whatever was focused before on close. Used by Modal and Drawer.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    restoreTo.current = document.activeElement as HTMLElement | null;

    const container = ref.current;
    if (container) {
      // Prefer the first real control; fall back to the panel itself so screen
      // readers announce the dialog rather than staying on the page behind it.
      const initial =
        container.querySelector<HTMLElement>('[data-autofocus]') ?? focusableWithin(container)[0];
      (initial ?? container).focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !ref.current) return;
      const items = focusableWithin(ref.current);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (!ref.current.contains(current)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const target = restoreTo.current;
      if (target && document.contains(target)) target.focus({ preventScroll: true });
    };
  }, [active, ref]);
}

/** ESC anywhere closes the topmost overlay. */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  // Written in an effect, not during render (TODO-26), and declared BEFORE
  // the subscribing effect so the newest handler is in place by the time the
  // listener exists. Safe here because `handler.current` is only ever read
  // from a document keydown listener, which cannot fire until that effect has
  // run — unlike a ref mutated during render, which can describe a render
  // React discarded without committing. Same idiom as `latest` in
  // lib/hotkeys.tsx.
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handler.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);
}

/** Prevents the page behind a modal from scrolling, without a layout jump. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [active]);
}

export function useOutsideClick(
  refs: React.RefObject<HTMLElement | null>[],
  active: boolean,
  onOutside: () => void,
) {
  // Both written in an effect rather than during render — see useEscapeKey
  // above. Neither is read outside the pointer listener installed below.
  const handler = useRef(onOutside);
  const stableRefs = useRef(refs);
  useEffect(() => {
    handler.current = onOutside;
    stableRefs.current = refs;
  });

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const inside = stableRefs.current.some((ref) => ref.current?.contains(target));
      if (!inside) handler.current();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
    };
  }, [active]);
}

/**
 * Latest-value callback ref, so effects do not re-subscribe on every render.
 *
 * The render-time ref write STAYS here, unlike the two hooks above (TODO-26).
 * They only read their ref from a listener that an effect installed, so the
 * write can wait for the commit. The callback this returns is handed to
 * callers who may invoke it from a layout effect or straight out of a render
 * path — before passive effects flush — and it would then call the PREVIOUS
 * render's function. That is a behaviour change, not a cleanup, and these
 * hooks sit under every modal in the app.
 */
export function useEvent<A extends unknown[], R>(fn: (...args: A) => R) {
  const ref = useRef(fn);
  // eslint-disable-next-line react-hooks/refs -- deliberate; see the doc above
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}

/**
 * Romanian-aware comparison. `localeCompare('ro')` puts ă/â/î/ș/ț where a
 * Romanian reader expects them; raw `<` on UTF-16 code units does not.
 */
export function compareValues(
  a: string | number | null,
  b: string | number | null,
): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'ro', { numeric: true, sensitivity: 'base' });
}

/**
 * Diacritic-insensitive contains, for Select's option filter. The fold itself
 * lives in `@/lib/search` — the UI kit already reaches into it for `rankBy`
 * (Autocomplete), and a second private copy of an NFD-strip is how the three
 * search boxes in this app drifted apart in the first place.
 */
export function matches(haystack: string, needle: string): boolean {
  return fold(haystack).includes(fold(needle));
}
