/**
 * Keyboard shortcuts and the registry behind the help overlay.
 *
 * A screen declares what its keys do with `useShortcuts([...])`; the provider
 * owns the single document listener and the chord state, and the help overlay
 * (`?`) renders whatever is registered *right now*, so the list a user sees is
 * always the list that actually works on the screen they are on.
 *
 * Combos are written the way they are pressed:
 *   "mod+k"  ⌘K on macOS, Ctrl+K elsewhere
 *   "?"      a single printable key
 *   "g c"    a chord — press g, then c within CHORD_TIMEOUT_MS
 *
 * Typing is sacred: while focus is in an input, textarea, select or
 * contenteditable, only `mod+…` combos fire. A dispatcher typing a client name
 * must never trigger "n = new order" halfway through "Ana". The same applies
 * while a modal dialog is open — the screen behind it keeps its keys but does
 * not act on them.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

const CHORD_TIMEOUT_MS = 1400;

export interface Shortcut {
  /** Combo string, e.g. "mod+k", "?", "g c". */
  combo: string;
  /** Romanian description shown in the help overlay. */
  description: string;
  /** Section heading in the help overlay, also Romanian. */
  group: string;
  run: () => void;
  /** Skip registration without breaking the hook order. */
  disabled?: boolean;
}

interface Registration {
  id: number;
  shortcuts: Shortcut[];
}

interface ShortcutContextValue {
  register: (id: number, shortcuts: Shortcut[]) => void;
  unregister: (id: number) => void;
  /** Everything currently active, in registration order. */
  active: Shortcut[];
  /** The chord prefix waiting for its second key, for the on-screen hint. */
  pending: string | null;
}

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

const IS_APPLE =
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

/** Renders a combo the way this platform's keyboard reads it. */
export function comboLabel(combo: string): string {
  return combo
    .split(' ')
    .map((part) =>
      part
        .split('+')
        .map((token) => {
          if (token === 'mod') return IS_APPLE ? '⌘' : 'Ctrl';
          if (token === 'shift') return IS_APPLE ? '⇧' : 'Shift';
          if (token === 'escape') return 'Esc';
          return token.length === 1 ? token.toUpperCase() : token;
        })
        .join(IS_APPLE ? '' : '+'),
    )
    .join(' , ');
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** The single-key token an event represents, e.g. "mod+k", "?", "n". */
function eventToken(event: KeyboardEvent): string {
  const key = event.key.toLowerCase();
  return event.metaKey || event.ctrlKey ? `mod+${key}` : key;
}

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const registrations = useRef<Registration[]>([]);
  const [active, setActive] = useState<Shortcut[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const pendingTimer = useRef<number | null>(null);

  const sync = useCallback(() => {
    setActive(registrations.current.flatMap((entry) => entry.shortcuts));
  }, []);

  const register = useCallback(
    (id: number, shortcuts: Shortcut[]) => {
      const existing = registrations.current.findIndex((entry) => entry.id === id);
      if (existing >= 0) registrations.current[existing] = { id, shortcuts };
      else registrations.current.push({ id, shortcuts });
      sync();
    },
    [sync],
  );

  const unregister = useCallback(
    (id: number) => {
      registrations.current = registrations.current.filter((entry) => entry.id !== id);
      sync();
    },
    [sync],
  );

  const clearPending = useCallback(() => {
    if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
    pendingTimer.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.isComposing) return;

      const token = eventToken(event);
      const modified = token.startsWith('mod+');
      const editable = isEditableTarget(event.target);
      if (editable && !modified) {
        if (pendingTimer.current !== null) clearPending();
        return;
      }

      // A modal dialog owns the keyboard while it is open: a bare "n" inside
      // an order drawer must not open a second one behind it. ⌘-combos still
      // pass through, so ⌘K can toggle the palette from anywhere.
      if (!modified && document.querySelector('[role="dialog"][aria-modal="true"]')) {
        if (pendingTimer.current !== null) clearPending();
        return;
      }

      const shortcuts = registrations.current.flatMap((entry) => entry.shortcuts);

      // Second half of a chord first, so "g" then "c" beats a bare "c".
      if (pending) {
        const chord = shortcuts.find(
          (shortcut) => !shortcut.disabled && shortcut.combo === `${pending} ${token}`,
        );
        clearPending();
        if (chord) {
          event.preventDefault();
          chord.run();
          return;
        }
      }

      const exact = shortcuts.find(
        (shortcut) => !shortcut.disabled && shortcut.combo === token,
      );
      if (exact) {
        event.preventDefault();
        exact.run();
        return;
      }

      const startsChord = shortcuts.some(
        (shortcut) => !shortcut.disabled && shortcut.combo.startsWith(`${token} `),
      );
      if (startsChord) {
        event.preventDefault();
        setPending(token);
        if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
        pendingTimer.current = window.setTimeout(() => {
          pendingTimer.current = null;
          setPending(null);
        }, CHORD_TIMEOUT_MS);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending, clearPending]);

  useEffect(
    () => () => {
      if (pendingTimer.current !== null) window.clearTimeout(pendingTimer.current);
    },
    [],
  );

  const value = useMemo<ShortcutContextValue>(
    () => ({ register, unregister, active, pending }),
    [register, unregister, active, pending],
  );

  return <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>;
}

let nextRegistrationId = 0;

/**
 * Registers shortcuts for as long as the calling component is mounted.
 * Safe to call outside a provider (it becomes a no-op), so a screen can be
 * rendered in isolation without wiring the shell.
 */
export function useShortcuts(shortcuts: Shortcut[]): void {
  const context = useContext(ShortcutContext);
  const id = useRef<number | null>(null);
  if (id.current === null) {
    nextRegistrationId += 1;
    id.current = nextRegistrationId;
  }

  const latest = useRef(shortcuts);
  latest.current = shortcuts;

  // Re-register when the *shape* changes (combos, labels, disabled flags);
  // the handlers themselves are read through `latest` on every keypress.
  const signature = shortcuts
    .map((item) => `${item.combo}|${item.description}|${item.group}|${item.disabled ? 1 : 0}`)
    .join('~');

  const register = context?.register;
  const unregister = context?.unregister;

  useEffect(() => {
    if (!register || !unregister || id.current === null) return;
    const registrationId = id.current;
    register(
      registrationId,
      latest.current.map((item, index) => ({
        ...item,
        run: () => latest.current[index]?.run(),
      })),
    );
    return () => unregister(registrationId);
  }, [register, unregister, signature]);
}

/** Everything currently registered — the help overlay's data source. */
export function useActiveShortcuts(): Shortcut[] {
  return useContext(ShortcutContext)?.active ?? [];
}

/** The chord prefix awaiting its second key, or null. */
export function usePendingChord(): string | null {
  return useContext(ShortcutContext)?.pending ?? null;
}
