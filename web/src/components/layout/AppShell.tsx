/**
 * Desktop shell: fixed sidebar + full-height content column.
 *
 * Deliberately not a phone layout — the sidebar is always visible, there is no
 * bottom tab bar, and content is free to use the full width for tables.
 *
 * Nav is role-aware: a section only appears if the signed-in user holds the
 * role that section's routes are gated on in src/routes/router.tsx (SALES for
 * Vânzări, TECH for Tehnic) — a Sales-only account never even sees a Tehnic
 * link it would bounce off of.
 *
 * The shell also owns the two app-wide keyboard affordances, because they must
 * work on every screen and outlive any single page:
 *   ⌘K / Ctrl+K  the command palette (jump to any record, run any action)
 *   ?            the shortcut help overlay, built from the live registry
 *   g then …     jump straight to a section
 * Screens add their own keys with `useShortcuts` from `@/lib/hotkeys`; they
 * appear in the help overlay automatically.
 */

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DATA_MODE } from '@/api';
import { useAuth } from '@/auth';
import { AccountMenu } from '@/features/auth/AccountMenu';
import { CommandPalette } from '@/features/command/CommandPalette';
import { GLOBAL_GROUP, ShortcutHelp } from '@/features/command/ShortcutHelp';
import { ShortcutProvider, comboLabel, useShortcuts, usePendingChord } from '@/lib/hotkeys';
import { UndoProvider, focusIsEditable, useUndo } from '@/lib/undo';
import type { Role } from '@/types/domain';

interface NavItem {
  to: string;
  label: string;
  /** Second key of the `g …` chord that jumps here. */
  chord: string;
}

interface NavSectionDef {
  title: string;
  /** Visible when the account holds ANY of these — matches RequireRole. */
  roles: Role[];
  items: NavItem[];
}

const NAV_SECTIONS: NavSectionDef[] = [
  {
    // Cross-module, so it sits above both sections rather than inside one.
    title: 'General',
    roles: ['SALES', 'TECH'],
    items: [{ to: '/harta', label: 'Hartă', chord: 'h' }],
  },
  {
    title: 'Vânzări',
    roles: ['SALES'],
    items: [
      { to: '/comenzi', label: 'Comenzi', chord: 'c' },
      { to: '/clienti', label: 'Clienți', chord: 'l' },
      { to: '/produse', label: 'Produse', chord: 'p' },
      { to: '/abonamente', label: 'Abonamente', chord: 'a' },
    ],
  },
  {
    title: 'Tehnic',
    roles: ['TECH'],
    items: [
      { to: '/rute', label: 'Rute', chord: 'r' },
      { to: '/sarcini', label: 'Sarcini', chord: 's' },
      { to: '/soferi', label: 'Șoferi', chord: 'd' },
      { to: '/recurente', label: 'Igienizări recurente', chord: 'i' },
    ],
  },
];

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="mb-5">
      <p className="mb-1 px-3 text-[0.6875rem] font-semibold tracking-wide text-white/40 uppercase">
        {title}
      </p>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'group flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors',
                isActive ? 'bg-white/15 font-medium text-white' : 'text-white/70 hover:bg-white/10',
              ].join(' ')
            }
          >
            <span className="truncate">{item.label}</span>
            <span
              aria-hidden
              className="ml-2 shrink-0 font-mono text-[0.625rem] text-white/0 transition-colors group-hover:text-white/45"
            >
              g {item.chord}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function AppShell() {
  return (
    <ShortcutProvider>
      {/* Above the screens, so an undo entry survives navigating away from the
          screen that pushed it — the inverse is a closure, not a component. */}
      <UndoProvider>
        <ShellBody />
      </UndoProvider>
    </ShortcutProvider>
  );
}

function ShellBody() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingChord = usePendingChord();

  const visibleSections = NAV_SECTIONS.filter((section) =>
    section.roles.some((role) => hasRole(role)),
  );

  const undoStack = useUndo();

  useShortcuts([
    {
      combo: 'mod+z',
      description: 'Anulează ultima acțiune',
      group: GLOBAL_GROUP,
      run: () => {
        // `mod+…` fires even inside a field; ⌘Z there belongs to the browser's
        // own text undo. See focusIsEditable().
        if (focusIsEditable()) return;
        undoStack.undo();
      },
    },
    {
      combo: 'mod+k',
      description: 'Căutare rapidă (clienți, comenzi, sarcini, rute, acțiuni)',
      group: GLOBAL_GROUP,
      run: () => {
        setHelpOpen(false);
        setPaletteOpen((open) => !open);
      },
    },
    {
      combo: '?',
      description: 'Arată scurtăturile disponibile',
      group: GLOBAL_GROUP,
      run: () => {
        setPaletteOpen(false);
        setHelpOpen((open) => !open);
      },
    },
    ...visibleSections.flatMap((section) =>
      section.items.map((item) => ({
        combo: `g ${item.chord}`,
        description: `Deschide ${item.label}`,
        group: 'Navigare',
        run: () => navigate(item.to),
      })),
    ),
  ]);

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col bg-brand-700 px-2 py-4">
        <div className="mb-4 px-3">
          <p className="text-sm font-semibold text-white">EcoTrack</p>
          <p className="text-xs text-white/50">Dami Prod</p>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-1 mb-5 flex items-center justify-between gap-2 rounded-md bg-white/10 px-2.5 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="7.2" cy="7.2" r="4.2" />
              <path d="m10.4 10.4 2.6 2.6" strokeLinecap="round" />
            </svg>
            <span className="truncate">Caută…</span>
          </span>
          <kbd className="shrink-0 rounded border border-white/25 px-1 font-mono text-[0.625rem] text-white/60">
            {comboLabel('mod+k')}
          </kbd>
        </button>

        {visibleSections.map((section) => (
          <NavSection key={section.title} title={section.title} items={section.items} />
        ))}

        <div className="mt-auto flex flex-col gap-2 px-1">
          {DATA_MODE === 'mock' && (
            <span className="mx-2 inline-flex w-fit items-center rounded bg-amber-400/20 px-1.5 py-0.5 text-xs text-amber-200">
              date demo
            </span>
          )}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="mx-1 rounded px-2 py-1 text-left text-xs text-white/45 transition-colors hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            Scurtături tastatură · ?
          </button>
          <div className="border-t border-white/10 pt-2">
            <AccountMenu />
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <Outlet />
      </main>

      {/* Chord feedback: "g" alone means nothing until the second key lands. */}
      {pendingChord && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-md bg-ink px-3 py-1.5 text-xs text-white shadow-popover"
        >
          <kbd className="font-mono">{pendingChord}</kbd> … apasă a doua tastă
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
