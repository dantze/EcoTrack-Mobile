/**
 * The global bar: the one strip that is identical on every screen.
 *
 * Outlook's arrangement — product identity left, search in the middle, account
 * and settings right — because that is where a back-office user's hand already
 * goes. It is navy in both themes: the bar is chrome, not content, and letting
 * it follow the page background is what makes an app look like a website.
 *
 * The search box is a BUTTON, not an input. It opens the command palette,
 * which searches records and runs actions; a real input here would offer a
 * second, weaker search next to the good one.
 */

import { Menu, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/shadcn/button';
import { Badge } from '@/components/shadcn/badge';
import { comboLabel } from '@/lib/hotkeys';
import { DATA_MODE } from '@/api';
import { AccountMenu } from '@/features/auth/AccountMenu';
import { ThemeToggle } from './ThemeToggle';

export function TopBar({
  onOpenNav,
  onOpenPalette,
  onOpenHelp,
}: {
  onOpenNav: () => void;
  onOpenPalette: () => void;
  onOpenHelp: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 bg-sidebar px-2 text-sidebar-foreground sm:px-3">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Deschide navigarea"
        onClick={onOpenNav}
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
      >
        <Menu />
      </Button>

      <div className="flex shrink-0 items-center gap-2 pl-1">
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded bg-primary text-[0.6875rem] font-bold text-primary-foreground"
        >
          ET
        </span>
        <span className="hidden text-sm font-semibold tracking-tight text-sidebar-foreground sm:inline">
          EcoTrack
        </span>
      </div>

      {/* Search occupies the centre column and shrinks first. */}
      <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-4">
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Căutare rapidă"
          className={cn(
            'flex h-8 w-full max-w-xl items-center gap-2 rounded-md px-2.5',
            'border border-sidebar-border bg-sidebar-accent',
            'text-left text-sm text-sidebar-foreground/70 transition-colors',
            'hover:bg-sidebar-accent-foreground/15 hover:text-sidebar-accent-foreground',
            'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
          )}
        >
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">Caută clienți, comenzi, sarcini…</span>
          <kbd className="hidden shrink-0 rounded border border-sidebar-border px-1 font-mono text-[0.625rem] text-sidebar-foreground/60 sm:inline">
            {comboLabel('mod+k')}
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {DATA_MODE === 'mock' && (
          <Badge
            variant="outline"
            // `text-warning-600`, not `-200`: the semantic ramps INVERT between
            // themes — 50/100/200 are fills and 600/700 are text — so a fill
            // shade used as text is a dark-brown label on a dark amber pill in
            // dark mode. 600 is the one step that stays legible on the rail,
            // which is navy in both themes.
            className="mr-1 hidden border-warning-600/40 bg-warning-600/15 text-[0.6875rem] text-warning-600 md:inline-flex"
          >
            date demo
          </Badge>
        )}
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Scurtături tastatură"
          onClick={onOpenHelp}
          className="hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground sm:inline-flex"
        >
          <span aria-hidden className="font-mono text-sm">
            ?
          </span>
        </Button>
        <AccountMenu />
      </div>
    </header>
  );
}
