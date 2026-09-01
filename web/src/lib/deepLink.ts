/**
 * Query-string deep links.
 *
 * The command palette cannot reach into a screen's local state, so it navigates
 * with an intent in the URL instead — `/comenzi?comanda=42`, `/clienti?nou=1` —
 * and the screen consumes it on arrival. The side effect is that every record
 * now has a shareable link: pasting `/sarcini?sarcina=88` into chat opens that
 * task's drawer for whoever clicks it.
 *
 * Params are Romanian to match the routes (`nou`, `comanda`, `client`,
 * `sarcina`, `ruta`). Consumed intents are cleared with `replace: true` so the
 * Back button does not walk the user through drawer re-openings.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface DeepLink {
  /** Positive integer value of a param, or null when absent/malformed. */
  number: (name: string) => number | null;
  /** True when the param is present and not "0"/"false". */
  flag: (name: string) => boolean;
  /**
   * Raw string value, or null when absent. For intents that are neither an id
   * nor a switch — `/calendar?zi=2026-08-14`. The caller validates the shape;
   * this only reads it.
   */
  raw: (name: string) => string | null;
  /** Drops the named params from the URL without adding a history entry. */
  clear: (...names: string[]) => void;
}

export function useDeepLink(): DeepLink {
  const [params, setParams] = useSearchParams();

  const number = useCallback(
    (name: string) => {
      const raw = params.get(name);
      if (raw === null) return null;
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    },
    [params],
  );

  const flag = useCallback(
    (name: string) => {
      const raw = params.get(name);
      return raw !== null && raw !== '0' && raw !== 'false';
    },
    [params],
  );

  const raw = useCallback((name: string) => params.get(name), [params]);

  const clear = useCallback(
    (...names: string[]) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const name of names) next.delete(name);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return useMemo(() => ({ number, flag, raw, clear }), [number, flag, raw, clear]);
}

/**
 * Consume a deep link exactly once: hand `value` to `apply`, then drop `name`
 * from the URL so the intent cannot fire again on the next render or reload.
 *
 * Nine copies of this effect existed, one per screen that accepts an intent,
 * each six lines of `if (value === null) return; …; deepLink.clear(name)`. They
 * are here now for two reasons. The obvious one is that nine copies of a rule
 * drift. The other is that every one of them tripped
 * `react-hooks/set-state-in-effect` (TODO-26) and the suppression is a judgement
 * call that deserved to be made once, in writing, rather than nine times by
 * whoever was editing a screen that day:
 *
 * **An effect is right here, and the rule's usual fixes are not.** The URL is an
 * external store owned by the router, not a prop this component derives from —
 * so there is nothing to compute during render. There is no event handler to
 * move the work into either: the navigation happened in the command palette, in
 * another tab, or in a pasted link, and the arrival IS the event. Consuming it
 * necessarily writes local state and rewrites the URL.
 *
 * The alternative that would delete the effect is to stop copying the intent
 * into state at all and let the URL *be* the open drawer — `?comanda=42` means
 * the detail drawer is open. That is a real design, and a bigger one: it changes
 * what Back does on every screen, so it is not something to smuggle in under a
 * lint fix. See TODO-26.
 *
 * `value` is passed in already parsed and validated so each screen keeps its own
 * reading of its own param, and a value the screen rejects is left in the URL
 * rather than silently swallowed.
 */
export function useDeepLinkOnce<T>(
  name: string,
  value: T | null,
  apply: (value: T) => void,
): void {
  const { clear } = useDeepLink();
  // `apply` is redeclared every render by every caller, so it must not be a
  // dependency: the intent is keyed by its VALUE, and re-running because a
  // closure changed identity would re-open a drawer the user just closed.
  //
  // Written in an effect rather than during render, and declared BEFORE the
  // consuming effect so the newest closure is already in place when it runs —
  // the same idiom, for the same reason, as `latest` in lib/hotkeys.tsx: React
  // may render without committing, and a ref mutated during render can end up
  // describing a render that never mounted.
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  useEffect(() => {
    if (value === null) return;
    applyRef.current(value);
    clear(name);
  }, [name, value, clear]);
}

/**
 * The flag-shaped intent — `/clienti?nou=1` — where presence is the whole
 * message. Same reasoning as {@link useDeepLinkOnce}.
 */
export function useDeepLinkFlagOnce(name: string, apply: () => void): void {
  const flagged = useDeepLink().flag(name);
  useDeepLinkOnce(name, flagged ? true : null, apply);
}
