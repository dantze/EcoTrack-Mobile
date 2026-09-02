/**
 * The application shell.
 *
 * Outlook's frame: a navy global bar across the top, a role-aware navigation
 * pane on the left, and the screen filling everything else. The pane collapses
 * to an icon rail on demand and disappears into a Sheet below `lg` — a phone
 * gets the whole width for content, which is the only way the dense screens in
 * this app are usable at 390 px.
 *
 * The shell also owns the app-wide keyboard affordances, because they must work
 * on every screen and outlive any single page:
 *   ⌘K / Ctrl+K  the command palette (jump to any record, run any action)
 *   ?            the shortcut help overlay, built from the live registry
 *   g then …     jump straight to a section
 *   [            collapse / expand the navigation pane
 * Screens add their own keys with `useShortcuts` from `@/lib/hotkeys`; they
 * appear in the help overlay automatically.
 */

import { Suspense, lazy, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth';
import { Button } from '@/components/shadcn/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/shadcn/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip';
import { GLOBAL_GROUP, ShortcutProvider, useShortcuts, usePendingChord } from '@/lib/hotkeys';
import { UndoProvider, focusIsEditable, useUndo } from '@/lib/undo';
import { NAV_SECTIONS, NavPane } from './nav';
import { TopBar } from './TopBar';
import { usePersistentState } from './Workbench';

/**
 * Both overlays are lazy, and the reason is weight rather than tidiness.
 *
 * The palette reaches for cmdk, the whole UI kit barrel (and through it
 * Mantine's date package) and both feature modules' query hooks, so importing
 * it from the shell put every one of those on the FIRST paint of every screen
 * — to render something that is invisible until ⌘K is pressed. Neither can be
 * opened before its chunk arrives, because the only thing that opens them is a
 * keystroke handled here.
 */
const CommandPalette = lazy(async () => ({
  default: (await import('@/features/command/CommandPalette')).CommandPalette,
}));

const ShortcutHelp = lazy(async () => ({
  default: (await import('@/features/command/ShortcutHelp')).ShortcutHelp,
}));

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
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = usePersistentState('ecotrack.nav.collapsed', false);
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
    {
      combo: '[',
      description: 'Restrânge / extinde panoul de navigare',
      group: GLOBAL_GROUP,
      run: () => setCollapsed(!collapsed),
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
    <div className="flex h-full flex-col bg-background">
      <TopBar
        onOpenNav={() => setNavOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Desktop pane. Hidden rather than unmounted below lg so its scroll
            position survives a resize. */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-150 lg:flex',
            collapsed ? 'w-[52px]' : 'w-[232px]',
          )}
        >
          <NavPane sections={visibleSections} collapsed={collapsed} />

          <div className="shrink-0 border-t border-border p-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={collapsed ? 'Extinde panoul' : 'Restrânge panoul'}
                  aria-expanded={!collapsed}
                  onClick={() => setCollapsed(!collapsed)}
                  className={cn('text-ink-muted', collapsed ? 'mx-auto flex' : 'ml-auto flex')}
                >
                  {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? 'Extinde panoul' : 'Restrânge panoul'}
                <span className="ml-2 font-mono text-[0.625rem] opacity-70">[</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <Outlet />
        </main>
      </div>

      {/* Mobile navigation. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[280px] gap-0 bg-surface p-0">
          <SheetHeader className="border-b border-border px-3 py-2.5">
            <SheetTitle className="text-sm">Navigare</SheetTitle>
          </SheetHeader>
          <NavPane sections={visibleSections} onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Chord feedback: "g" alone means nothing until the second key lands. */}
      {pendingChord && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-md bg-surface-inverse px-3 py-1.5 text-xs text-ink-inverse shadow-popover"
        >
          <kbd className="font-mono">{pendingChord}</kbd> … apasă a doua tastă
        </div>
      )}

      {/* No fallback: there is nothing to show while a dialog that is not on
          screen yet loads, and a spinner over the page would be worse than the
          ~80ms of nothing. */}
      <Suspense fallback={null}>
        {paletteOpen && <CommandPalette open onClose={() => setPaletteOpen(false)} />}
        {helpOpen && <ShortcutHelp open onClose={() => setHelpOpen(false)} />}
      </Suspense>
    </div>
  );
}
