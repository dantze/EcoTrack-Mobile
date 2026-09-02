/**
 * Command palette — ⌘K / Ctrl+K from anywhere in the app.
 *
 * The point is to collapse "sidebar → screen → filter → scroll → click" into
 * one keystroke and a few letters. It searches four record types plus the
 * navigation and creation commands, all from data already in the TanStack
 * Query cache; there is no search endpoint and none is needed at this scale
 * (a few hundred rows per collection).
 *
 * Ranking is `lib/search` relevance plus a `lib/recents` bonus, so the clients
 * and routes this operator opened yesterday surface first on a two-letter
 * query. Nothing here writes: picking a row navigates, and creation commands
 * only open the same form the "+" button opens.
 *
 * Role-aware by construction: a Sales-only account never sees Tehnic entries,
 * and the queries behind them stay disabled so no forbidden request is made.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/shadcn/command';
import { ORDER_TYPE_LABELS, TASK_TYPE_LABELS, formatDate, weekdayLabel } from '@/components/domain';
import { useAuth } from '@/auth';
import { boost, recentIds, recordUse, recentsRevision, subscribeRecents } from '@/lib/recents';
import { rankBy, splitHighlight, type MatchRange } from '@/lib/search';
import { clientName, type Role } from '@/types/domain';
import { useClients, useOrders } from '@/features/sales/queries';
import { useDrivers, useRecurring, useRoutes, useTasks } from '@/features/technical/queries';
import { orderAddress, orderPrimaryDate, orderSummary } from '@/features/sales/orderModel';
import { frequencyLabel, routeLabel, taskDate } from '@/features/technical/utils';

type EntryKind = 'command' | 'client' | 'order' | 'task' | 'route' | 'recurring' | 'driver';

interface Entry {
  id: string;
  kind: EntryKind;
  /** Matched and highlighted. */
  title: string;
  subtitle?: string;
  /** Extra text that is searchable but never displayed. */
  keywords?: string;
  /** Ranking bonus key in the recents log; commands use their own id. */
  recentId?: string;
  run: () => void;
}

const KIND_LABELS: Record<EntryKind, string> = {
  command: 'Acțiuni',
  client: 'Clienți',
  order: 'Comenzi',
  task: 'Sarcini',
  route: 'Rute',
  recurring: 'Igienizări recurente',
  driver: 'Șoferi',
};

/** Records opened without a query — the "you were just here" list. */
const IDLE_LIMIT = 6;
const RESULT_LIMIT = 24;

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Fresh state per open, by REMOUNTING rather than by an effect (TODO-26).
 *
 * The palette used to stay mounted with a stale query and highlight, clearing
 * them in an effect on close. It renders nothing while closed, so unmounting
 * is the same reset with no extra render — and the shortcut that opens it
 * lives in AppShell, not here, so nothing is lost by not being mounted.
 *
 * The queries below are unaffected: they were already gated on `enabled: open`
 * and their data lives in the QueryClient cache, which outlives this mount.
 */
export function CommandPalette(props: CommandPaletteProps) {
  if (!props.open) return null;
  return <Palette {...props} />;
}

function Palette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [query, setQuery] = useState('');

  // Re-rank as soon as a pick is recorded, so reopening the palette reflects it.
  useSyncExternalStore(subscribeRecents, recentsRevision, recentsRevision);

  const isSales = hasRole('SALES');
  const isTech = hasRole('TECH');

  // Only fetch while the palette is open, and only what this account may read.
  const clientsQuery = useClients({ enabled: open && isSales });
  const ordersQuery = useOrders({ enabled: open && isSales });
  const tasksQuery = useTasks({ enabled: open && isTech });
  const routesQuery = useRoutes({ enabled: open && isTech });
  const recurringQuery = useRecurring('all', { enabled: open && isTech });
  const driversQuery = useDrivers({ enabled: open && isTech });

  const entries = useMemo<Entry[]>(() => {
    const go = (path: string, recentKey: string) => () => {
      recordUse('command', recentKey);
      navigate(path);
      onClose();
    };

    const list: Entry[] = [];

    // `roles` is any-of, matching RequireRole — the map is reachable by both,
    // and must still produce exactly ONE entry for an account that holds both.
    const navItems: { path: string; label: string; roles: Role[]; keywords?: string }[] = [
      { path: '/harta', label: 'Hartă', roles: ['SALES', 'TECH'], keywords: 'map locatii geografic' },
      { path: '/comenzi', label: 'Comenzi', roles: ['SALES'], keywords: 'vanzari orders' },
      { path: '/calendar', label: 'Calendar', roles: ['SALES'], keywords: 'luna zile programare comenzi' },
      { path: '/clienti', label: 'Clienți', roles: ['SALES'], keywords: 'clients firme persoane' },
      { path: '/produse', label: 'Produse', roles: ['SALES'], keywords: 'catalog preturi' },
      { path: '/abonamente', label: 'Abonamente', roles: ['SALES'], keywords: 'subscriptii' },
      { path: '/rute', label: 'Rute', roles: ['TECH'], keywords: 'dispecerat planificare' },
      { path: '/sarcini', label: 'Sarcini', roles: ['TECH'], keywords: 'tasks lucrari' },
      { path: '/angajati', label: 'Angajați', roles: ['ADMIN'], keywords: 'soferi angajati drivers acces' },
      { path: '/cereri', label: 'Cereri de acces', roles: ['ADMIN'], keywords: 'aprobare acces enrollment' },
      { path: '/recurente', label: 'Igienizări recurente', roles: ['TECH'], keywords: 'planuri' },
    ];

    for (const item of navItems) {
      if (!item.roles.some((role) => hasRole(role))) continue;
      list.push({
        id: `nav:${item.path}`,
        kind: 'command',
        title: `Mergi la ${item.label}`,
        subtitle: item.path,
        keywords: item.keywords,
        recentId: `nav:${item.path}`,
        run: go(item.path, `nav:${item.path}`),
      });
    }

    if (isSales) {
      list.push({
        id: 'new:order',
        kind: 'command',
        title: 'Comandă nouă',
        subtitle: 'Deschide formularul de comandă',
        keywords: 'adauga creeaza order nou',
        recentId: 'new:order',
        run: go('/comenzi?nou=1', 'new:order'),
      });
      list.push({
        id: 'new:client',
        kind: 'command',
        title: 'Client nou',
        subtitle: 'Deschide formularul de client',
        keywords: 'adauga creeaza client nou',
        recentId: 'new:client',
        run: go('/clienti?nou=1', 'new:client'),
      });
    }

    if (isTech) {
      list.push({
        id: 'new:route',
        kind: 'command',
        title: 'Rută nouă',
        subtitle: 'Deschide formularul de rută',
        keywords: 'adauga creeaza ruta noua',
        recentId: 'new:route',
        run: go('/rute?nou=1', 'new:route'),
      });
      list.push({
        id: 'new:employee',
        kind: 'command',
        title: 'Angajat nou',
        subtitle: 'Deschide formularul de angajat',
        keywords: 'adauga creeaza sofer angajat nou employee',
        recentId: 'new:employee',
        run: go('/angajati?nou=1', 'new:employee'),
      });
    }

    for (const client of clientsQuery.data ?? []) {
      const fiscal = client.type === 'company' ? client.CUI : client.CNP;
      list.push({
        id: `client:${client.id}`,
        kind: 'client',
        title: clientName(client),
        subtitle: [client.type === 'company' ? 'PJ' : 'PF', client.phone, client.address]
          .filter(Boolean)
          .join(' · '),
        keywords: [fiscal, client.email, client.phone].filter(Boolean).join(' '),
        recentId: `client:${client.id}`,
        run: () => {
          recordUse('client', client.id);
          navigate(`/clienti?client=${client.id}`);
          onClose();
        },
      });
    }

    for (const order of ordersQuery.data ?? []) {
      list.push({
        id: `order:${order.id}`,
        kind: 'order',
        title: `#${order.number} · ${clientName(order.client)}`,
        subtitle: [
          ORDER_TYPE_LABELS[order.orderType],
          orderSummary(order),
          formatDate(orderPrimaryDate(order)),
        ]
          .filter(Boolean)
          .join(' · '),
        keywords: orderAddress(order) ?? undefined,
        recentId: `order:${order.id}`,
        run: () => {
          recordUse('order', order.id);
          navigate(`/comenzi?comanda=${order.id}`);
          onClose();
        },
      });
    }

    for (const task of tasksQuery.data ?? []) {
      list.push({
        id: `task:${task.id}`,
        kind: 'task',
        title: task.clientName ?? `Sarcina #${task.id}`,
        subtitle: [
          TASK_TYPE_LABELS[task.type],
          formatDate(taskDate(task)),
          task.route ? routeLabel(task.route) : 'Neasignată',
        ]
          .filter(Boolean)
          .join(' · '),
        keywords: [task.address, task.productName, task.contactPerson].filter(Boolean).join(' '),
        recentId: `task:${task.id}`,
        run: () => {
          recordUse('task', task.id);
          navigate(`/sarcini?sarcina=${task.id}`);
          onClose();
        },
      });
    }

    for (const plan of recurringQuery.data ?? []) {
      list.push({
        id: `recurring:${plan.id}`,
        kind: 'recurring',
        title: clientName(plan.client),
        subtitle: [
          frequencyLabel(plan.frequencyDays),
          plan.route ? routeLabel(plan.route) : 'Neasignat',
          plan.active ? null : 'Inactiv',
        ]
          .filter(Boolean)
          .join(' · '),
        keywords: [plan.sanitationLocationAddress, plan.contact, plan.subscription?.name]
          .filter(Boolean)
          .join(' '),
        recentId: `recurring:${plan.id}`,
        run: () => {
          recordUse('recurring', plan.id);
          navigate(`/recurente?plan=${plan.id}`);
          onClose();
        },
      });
    }

    for (const driver of driversQuery.data ?? []) {
      list.push({
        id: `driver:${driver.id}`,
        kind: 'driver',
        title: driver.fullName,
        subtitle: [driver.username, driver.phone, driver.county].filter(Boolean).join(' · '),
        keywords: [driver.username, driver.phone, driver.county].filter(Boolean).join(' '),
        recentId: `driver:${driver.id}`,
        run: () => {
          recordUse('driver', driver.id);
          navigate(`/angajati?sofer=${driver.id}`);
          onClose();
        },
      });
    }

    for (const route of routesQuery.data ?? []) {
      list.push({
        id: `route:${route.id}`,
        kind: 'route',
        title: routeLabel(route),
        subtitle: [
          weekdayLabel(route.dayOfWeek),
          route.county,
          route.employee?.fullName ?? 'Fără șofer',
          `${route.tasks?.length ?? 0} sarcini`,
        ]
          .filter(Boolean)
          .join(' · '),
        recentId: `route:${route.id}`,
        run: () => {
          recordUse('route', route.id);
          navigate(`/rute?ruta=${route.id}`);
          onClose();
        },
      });
    }

    return list;
  }, [
    clientsQuery.data,
    ordersQuery.data,
    tasksQuery.data,
    routesQuery.data,
    recurringQuery.data,
    driversQuery.data,
    hasRole,
    isSales,
    isTech,
    navigate,
    onClose,
  ]);

  const results = useMemo<{ entry: Entry; ranges: MatchRange[] }[]>(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      // Idle state: the commands, then whatever was opened most recently.
      const commands = entries.filter((entry) => entry.kind === 'command');
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      const recent: Entry[] = [];
      for (const kind of ['client', 'order', 'task', 'route'] as const) {
        for (const id of recentIds(kind, IDLE_LIMIT)) {
          const found = byId.get(`${kind}:${id}`);
          if (found) recent.push(found);
        }
      }
      return [...recent.slice(0, IDLE_LIMIT), ...commands].map((entry) => ({
        entry,
        ranges: [] as MatchRange[],
      }));
    }

    return rankBy(entries, trimmed, (entry) => [entry.title, entry.subtitle, entry.keywords], {
      boost: (entry) =>
        entry.recentId
          ? boost(entry.kind === 'command' ? 'command' : entry.kind, entry.recentId)
          : 0,
      limit: RESULT_LIMIT,
    }).map(({ item, ranges }) => ({ entry: item, ranges }));
  }, [entries, query]);

  const loading =
    clientsQuery.isLoading || ordersQuery.isLoading || tasksQuery.isLoading || routesQuery.isLoading;

  // Ranked order first, grouped second: the groups are a reading aid, not a
  // re-sort. Walking the ranked list and opening a new group whenever the kind
  // changes keeps the best match at the top of the dialog no matter which kind
  // it belongs to.
  const groups = useMemo(() => {
    const out: { kind: EntryKind; rows: { entry: Entry; ranges: MatchRange[] }[] }[] = [];
    for (const row of results) {
      const last = out[out.length - 1];
      if (last && last.kind === row.entry.kind) last.rows.push(row);
      else out.push({ kind: row.entry.kind, rows: [row] });
    }
    return out;
  }, [results]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Căutare rapidă"
      description="Caută clienți, comenzi, sarcini, rute sau acțiuni"
      className="max-w-2xl"
    >
      {/* cmdk owns the keyboard and the aria wiring; it does NOT own the
          ranking. `shouldFilter={false}` hands it a list already ordered by
          `rankBy` plus the recents boost — its own substring scorer knows
          nothing about which client this operator opened yesterday. */}
      <Command shouldFilter={false} loop label="Căutare rapidă">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Caută client, comandă, sarcină, rută sau acțiune…"
          autoFocus
        />
        <CommandList className="max-h-[60vh] scroll-py-2">
          <CommandEmpty>
            {loading ? 'Se încarcă datele…' : 'Niciun rezultat. Încearcă alt cuvânt.'}
          </CommandEmpty>

          {groups.map((group) => (
            <CommandGroup key={group.kind} heading={KIND_LABELS[group.kind]}>
              {group.rows.map(({ entry, ranges }) => (
                <CommandItem
                  key={entry.id}
                  value={entry.id}
                  onSelect={() => entry.run()}
                  className="gap-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">
                      {splitHighlight(entry.title, ranges).map((part, partIndex) =>
                        part.hit ? (
                          <mark
                            key={partIndex}
                            className="bg-transparent font-semibold text-primary"
                          >
                            {part.text}
                          </mark>
                        ) : (
                          <span key={partIndex}>{part.text}</span>
                        ),
                      )}
                    </span>
                    {entry.subtitle && (
                      <span className="block truncate text-xs text-ink-subtle">
                        {entry.subtitle}
                      </span>
                    )}
                  </span>
                  <CommandShortcut className="opacity-0 group-data-selected/command-item:opacity-100">
                    ↵
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>

        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-ink-subtle">
          <span className="truncate">
            {query.trim()
              ? `${results.length} rezultate`
              : 'Deschise recent pe acest calculator'}
          </span>
          <span className="hidden shrink-0 gap-2 sm:flex">
            <span>
              <kbd className="rounded border border-border px-1 font-mono">↑↓</kbd> navighează
            </span>
            <span>
              <kbd className="rounded border border-border px-1 font-mono">↵</kbd> deschide
            </span>
            <span>
              <kbd className="rounded border border-border px-1 font-mono">esc</kbd> închide
            </span>
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
