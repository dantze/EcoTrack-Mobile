/**
 * Desktop shell: fixed sidebar + full-height content column.
 *
 * Deliberately not a phone layout — the sidebar is always visible, there is no
 * bottom tab bar, and content is free to use the full width for tables.
 */

import { NavLink, Outlet } from 'react-router-dom';
import { DATA_MODE } from '@/api';

interface NavItem {
  to: string;
  label: string;
}

const SALES_NAV: NavItem[] = [
  { to: '/comenzi', label: 'Comenzi' },
  { to: '/clienti', label: 'Clienți' },
  { to: '/produse', label: 'Produse' },
  { to: '/abonamente', label: 'Abonamente' },
];

const TECHNICAL_NAV: NavItem[] = [
  { to: '/rute', label: 'Rute' },
  { to: '/sarcini', label: 'Sarcini' },
  { to: '/soferi', label: 'Șoferi' },
  { to: '/recurente', label: 'Igienizări recurente' },
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
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                isActive ? 'bg-white/15 font-medium text-white' : 'text-white/70 hover:bg-white/10',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function AppShell() {
  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col bg-brand-700 px-2 py-4">
        <div className="mb-6 px-3">
          <p className="text-sm font-semibold text-white">EcoTrack</p>
          <p className="text-xs text-white/50">Dami Prod</p>
        </div>

        <NavSection title="Vânzări" items={SALES_NAV} />
        <NavSection title="Tehnic" items={TECHNICAL_NAV} />

        <div className="mt-auto px-3">
          {DATA_MODE === 'mock' && (
            <span className="inline-flex items-center rounded bg-amber-400/20 px-1.5 py-0.5 text-xs text-amber-200">
              date demo
            </span>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <Outlet />
      </main>
    </div>
  );
}
