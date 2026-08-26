/**
 * A single application-wide undo stack, driven by ⌘Z / Ctrl+Z.
 *
 * The dispatch board is a place where one wrong drag quietly moves a driver's
 * whole afternoon, and the only recovery was to remember the previous state and
 * redo it by hand. This gives every reversible action an explicit inverse and
 * one keystroke to run it.
 *
 * **The inverse is supplied by the caller, not derived here.** Only the screen
 * performing the change knows what "before" looked like — the previous status,
 * the previous route, the previous stop order — and it knows it at the moment
 * it acts, before the server answers. Trying to reconstruct that afterwards
 * from the query cache is guesswork, because an invalidation may already have
 * replaced it.
 *
 * Deliberately NOT undoable: creates and deletes. Undoing a delete means
 * re-creating a row, which the backend hands a fresh id — every task, photo
 * and route that referenced the old one would still be dangling, so "undo"
 * would silently produce a different record wearing the same name. A confirm
 * dialog is the right guard there, and those already exist.
 *
 * There is no redo. Undo here means "I did not mean that", and a stack you can
 * walk in both directions invites treating the board as a scratchpad while the
 * server has already been told. One level of regret, honestly applied.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from '@/components/ui';

/** How many steps back the stack remembers. */
const MAX_DEPTH = 25;

export interface UndoEntry {
  /**
   * Romanian, and phrased to complete "Anulat: …" — e.g. "mutarea sarcinii pe
   * Ruta 4". The operator has to recognise what is about to be reversed from
   * this alone.
   */
  label: string;
  /** Performs the inverse. Rejects if it could not be applied. */
  invert: () => Promise<unknown>;
}

interface UndoContextValue {
  push: (entry: UndoEntry) => void;
  undo: () => void;
  clear: () => void;
  canUndo: boolean;
  /** Label of the action ⌘Z would reverse, for hints and the help overlay. */
  nextLabel: string | null;
  busy: boolean;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function UndoProvider({ children }: { children: ReactNode }) {
  // The stack lives in a ref: pushing must never re-render the screen that is
  // mid-mutation. Only the summary below is state.
  const stack = useRef<UndoEntry[]>([]);
  const [summary, setSummary] = useState<{ depth: number; label: string | null }>({
    depth: 0,
    label: null,
  });
  const [busy, setBusy] = useState(false);

  const sync = useCallback(() => {
    const top = stack.current[stack.current.length - 1] ?? null;
    setSummary({ depth: stack.current.length, label: top?.label ?? null });
  }, []);

  const push = useCallback(
    (entry: UndoEntry) => {
      stack.current.push(entry);
      if (stack.current.length > MAX_DEPTH) stack.current.shift();
      sync();
    },
    [sync],
  );

  const clear = useCallback(() => {
    stack.current = [];
    sync();
  }, [sync]);

  const undo = useCallback(() => {
    // Guard against a held-down ⌘Z firing the same inverse repeatedly while
    // the first request is still in flight.
    if (busy) return;
    const entry = stack.current.pop();
    sync();
    if (!entry) {
      toast.info('Nimic de anulat.');
      return;
    }

    setBusy(true);
    void entry
      .invert()
      .then(() => toast.success(`Anulat: ${entry.label}`))
      .catch(() => {
        // Not re-pushed: the server state is now unknown to us, and offering to
        // "undo" again from a failed inverse would compound the problem.
        toast.error(`Nu s-a putut anula ${entry.label}. Verifică starea curentă.`);
      })
      .finally(() => setBusy(false));
  }, [busy, sync]);

  const value = useMemo<UndoContextValue>(
    () => ({
      push,
      undo,
      clear,
      canUndo: summary.depth > 0,
      nextLabel: summary.label,
      busy,
    }),
    [push, undo, clear, summary.depth, summary.label, busy],
  );

  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
}

const NOOP: UndoContextValue = {
  push: () => {},
  undo: () => {},
  clear: () => {},
  canUndo: false,
  nextLabel: null,
  busy: false,
};

/**
 * Safe outside a provider (it becomes a no-op), so a screen can be rendered in
 * isolation — in a test, or in the dev harness — without wiring the shell.
 */
export function useUndo(): UndoContextValue {
  return useContext(UndoContext) ?? NOOP;
}

/**
 * True when the keystroke should be left to the browser.
 *
 * `mod+…` combos deliberately fire even while focus is in a field (that is how
 * ⌘K works from anywhere), but ⌘Z inside a text box must stay the browser's
 * own text undo — stealing it to revert a route change while someone is typing
 * an address would be indefensible.
 */
export function focusIsEditable(): boolean {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
