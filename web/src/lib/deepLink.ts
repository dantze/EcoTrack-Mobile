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

import { useCallback, useMemo } from 'react';
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
