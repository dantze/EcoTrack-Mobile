/**
 * Colour-scheme ownership.
 *
 * Two libraries need to agree on light/dark and neither can be the source of
 * truth for the other: shadcn/Tailwind switch on a `.dark` class on <html>,
 * Mantine on `data-mantine-color-scheme`. This provider owns the preference,
 * writes BOTH, and hands Mantine a `forceColorScheme` so it never runs its own
 * (conflicting) manager.
 *
 * Three states, like every desktop app: `light`, `dark`, `system`. `system`
 * follows `prefers-color-scheme` live — a laptop that flips at sunset flips the
 * app with it, without a reload.
 *
 * The preference is written to localStorage under a versioned key and applied
 * by an inline script in index.html BEFORE first paint, so a dark-mode user
 * never sees a white flash.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = 'ecotrack.theme.v1';

interface ThemeContextValue {
  /** What the user picked. */
  preference: ThemePreference;
  /** What that resolves to right now. */
  scheme: ResolvedScheme;
  setPreference: (next: ThemePreference) => void;
  /** Light ⇄ dark, collapsing `system` to the opposite of what is showing. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Private mode, or storage disabled. The default is fine.
  }
  return 'system';
}

function systemScheme(): ResolvedScheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(scheme: ResolvedScheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', scheme === 'dark');
  root.dataset.mantineColorScheme = scheme;
  root.style.colorScheme = scheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored);
  const [system, setSystem] = useState<ResolvedScheme>(systemScheme);

  // Live system tracking. Subscribed once; the listener only ever writes a
  // value that differs, so a media-query notification cannot loop.
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const scheme: ResolvedScheme = preference === 'system' ? system : preference;

  useEffect(() => {
    apply(scheme);
  }, [scheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice simply does not survive a reload.
    }
  }, []);

  const toggle = useCallback(() => {
    setPreferenceState((current) => {
      const showing = current === 'system' ? systemScheme() : current;
      const next: ThemePreference = showing === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* see above */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ preference, scheme, setPreference, toggle }),
    [preference, scheme, setPreference, toggle],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) {
    // Not a crash: a component rendered outside the provider (a test harness,
    // a portal mounted early) still gets a working, light-mode reading.
    return {
      preference: 'light',
      scheme: 'light',
      setPreference: () => {},
      toggle: () => {},
    };
  }
  return context;
}
