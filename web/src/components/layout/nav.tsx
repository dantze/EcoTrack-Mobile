/**
 * The navigation pane and the definition of the app's sections.
 *
 * Nav is role-aware: a section only appears if the signed-in account holds the
 * role its routes are gated on in src/routes/router.tsx. A Sales-only account
 * never sees a Tehnic link it would bounce off.
 *
 * Two presentations, Outlook's own:
 *   expanded  232 px, labels + chord hints, remembered across sessions
 *   collapsed 52 px icon rail, labels moved into tooltips
 * Below `lg` the pane is not on screen at all — it opens as a Sheet from the
 * burger in the top bar, because 232 px out of 390 px is not a navigation pane,
 * it is the whole screen.
 */

import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  Contact,
  ListChecks,
  Map as MapIcon,
  Package,
  RefreshCw,
  Repeat,
  Route as RouteIcon,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip';
import type { Role } from '@/types/domain';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Second key of the `g …` chord that jumps here. */
  chord: string;
}

export interface NavSectionDef {
  title: string;
  /** Visible when the account holds ANY of these — matches RequireRole. */
  roles: Role[];
  items: NavItem[];
}

export const NAV_SECTIONS: NavSectionDef[] = [
  {
    // Cross-module, so it sits above both sections rather than inside one.
    title: 'General',
    roles: ['SALES', 'TECH'],
    items: [{ to: '/harta', label: 'Hartă', icon: MapIcon, chord: 'h' }],
  },
  {
    title: 'Vânzări',
    roles: ['SALES'],
    items: [
      { to: '/comenzi', label: 'Comenzi', icon: ClipboardList, chord: 'c' },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays, chord: 'd' },
      { to: '/clienti', label: 'Clienți', icon: Users, chord: 'l' },
      { to: '/produse', label: 'Produse', icon: Package, chord: 'p' },
      { to: '/abonamente', label: 'Abonamente', icon: Repeat, chord: 'a' },
    ],
  },
  {
    title: 'Tehnic',
    roles: ['TECH'],
    items: [
      { to: '/rute', label: 'Rute', icon: RouteIcon, chord: 'r' },
      { to: '/sarcini', label: 'Sarcini', icon: ListChecks, chord: 's' },
      { to: '/recurente', label: 'Igienizări recurente', icon: RefreshCw, chord: 'i' },
    ],
  },
  {
    // Admin-only. `hasRole` treats ADMIN as satisfying every gate, so this is
    // the one section that is genuinely exclusive rather than additive.
    title: 'Admin',
    roles: ['ADMIN'],
    items: [
      { to: '/cereri', label: 'Cereri de acces', icon: ShieldCheck, chord: 'q' },
      { to: '/angajati', label: 'Angajați', icon: Contact, chord: 'e' },
    ],
  },
];

function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-md text-sm transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-1.5',
          isActive
            ? 'bg-surface-active font-semibold text-ink'
            : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Outlook marks the current folder with an accent bar, not a fill. */}
          <span
            aria-hidden
            className={cn(
              'absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon className="size-4 shrink-0" aria-hidden />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span
                aria-hidden
                className="shrink-0 font-mono text-[0.625rem] text-transparent transition-colors group-hover:text-ink-subtle"
              >
                g {item.chord}
              </span>
            </>
          )}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {item.label}
        <span className="ml-2 font-mono text-[0.625rem] opacity-70">g {item.chord}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function NavPane({
  sections,
  collapsed = false,
  onNavigate,
  className,
}: {
  sections: NavSectionDef[];
  collapsed?: boolean;
  /** Called after a link is followed — closes the mobile Sheet. */
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="Navigare principală"
      className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-3', className)}
    >
      {sections.map((section) => (
        <div key={section.title} className={cn('flex flex-col gap-0.5', collapsed ? 'px-2' : 'px-2')}>
          {collapsed ? (
            <span aria-hidden className="mx-auto mb-1 h-px w-6 bg-border first:hidden" />
          ) : (
            <p className="mb-1 px-2.5 text-[0.6875rem] font-semibold tracking-wide text-ink-subtle uppercase">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavRow key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
