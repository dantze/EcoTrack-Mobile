/**
 * The workbench: the frame every screen renders into.
 *
 * Outlook's shape, in three parts — a command bar pinned to the top, a body
 * that is the ONLY vertical scroll container, and (optionally) a reading pane
 * split inside it. Screens compose these instead of inventing a header each:
 * before this existed, six screens had six slightly different title rows.
 *
 *   <Workbench>
 *     <CommandBar title="Comenzi" subtitle="128 comenzi" actions={…} tools={…} />
 *     <ListDetail list={…} detail={…} … />
 *   </Workbench>
 *
 * The one layout rule that keeps it reliable: every level from `#root` down to
 * the scrolling body is `flex` + `min-h-0`. A single missing `min-h-0` and the
 * body stops scrolling and pushes the page instead — which is exactly how a
 * sticky header ends up scrolling away.
 */

import { useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu';
import { Separator } from '@/components/shadcn/separator';

export function Workbench({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="workbench"
      className={cn('flex h-full min-h-0 flex-1 flex-col bg-background', className)}
    >
      {children}
    </div>
  );
}

/** Scrolling body for screens that do not use a reading pane. */
export function WorkbenchBody({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  /** Off for edge-to-edge content: a table, a map, a board. */
  padded?: boolean;
}) {
  return (
    <div
      data-slot="workbench-body"
      className={cn(
        'min-h-0 flex-1 overflow-auto overscroll-contain',
        padded && 'p-3 sm:p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface CommandBarProps {
  title: ReactNode;
  /** Count, filter summary, or similar context under the title. */
  subtitle?: ReactNode;
  /** The ribbon: primary and secondary actions, left-aligned. */
  actions?: ReactNode;
  /** Search, view switches, filters — right-aligned, next to the title. */
  tools?: ReactNode;
  /** A pivot row under the ribbon (the kit's `Tabs`). */
  tabs?: ReactNode;
  /**
   * Extra actions that only appear in the `⋯` menu on narrow viewports.
   * The ribbon itself stays reachable there by scrolling horizontally, so this
   * is for actions a phone user genuinely needs rather than a duplicate list.
   */
  overflow?: ReactNode;
  className?: string;
}

/**
 * The ribbon.
 *
 * Sticky, translucent over the scrolling body, and hairline-separated from it.
 * The action strip scrolls horizontally rather than wrapping: a toolbar that
 * silently becomes three rows tall is what pushes the table below the fold on
 * a laptop.
 */
export function CommandBar({
  title,
  subtitle,
  actions,
  tools,
  tabs,
  overflow,
  className,
}: CommandBarProps) {
  return (
    <header
      data-slot="command-bar"
      className={cn(
        'sticky top-0 z-20 shrink-0 border-b border-border bg-surface-header/95 backdrop-blur-sm',
        'supports-backdrop-filter:bg-surface-header/80',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-3 pt-2.5 pb-2 sm:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[0.9375rem] leading-tight font-semibold text-ink">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p>
          ) : null}
        </div>

        {tools ? (
          <div className="flex shrink-0 items-center gap-1.5">{tools}</div>
        ) : null}

        {overflow ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Mai multe acțiuni" className="lg:hidden">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>{overflow}</DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {actions ? (
        <div className="scroll-fade-x flex items-center gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
          {actions}
        </div>
      ) : null}

      {tabs ? <div className="px-3 sm:px-4">{tabs}</div> : null}
    </header>
  );
}

/** A labelled cluster inside the ribbon, Outlook's grouped-command idea. */
export function ToolbarGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('flex shrink-0 items-center gap-1', className)}>{children}</div>;
}

export function ToolbarSeparator({ className }: { className?: string }) {
  return (
    <Separator
      orientation="vertical"
      className={cn('mx-1 !h-5 shrink-0 bg-border', className)}
    />
  );
}

/**
 * Header for a pane inside a split — smaller than a CommandBar, and it does not
 * repeat the page title.
 */
export function PaneHeader({
  title,
  subtitle,
  actions,
  onClose,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-start gap-2 border-b border-border bg-surface px-3 py-2.5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      {onClose ? (
        <Button variant="ghost" size="icon-sm" aria-label="Închide panoul" onClick={onClose}>
          <span aria-hidden>×</span>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Local UI state that must survive a reload but means nothing to anyone else —
 * a pane width, a collapsed rail, a density choice.
 *
 * Deliberately not `useLocalStorage` from Mantine: that hook subscribes to the
 * storage event so two tabs stay in sync, and two Outlook windows deliberately
 * do NOT share a pane width. Reads once, writes on change, never throws when
 * storage is unavailable.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const write = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Private mode. The choice simply does not survive a reload.
    }
  };

  return [value, write] as const;
}
