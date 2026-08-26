/**
 * Route and driver pickers.
 *
 * Both are used from several screens (bulk reassign, drag-in fallback, driver
 * change, recurring assignment), so they live here rather than in a page.
 *
 * Both are keyboard-first: the filter box takes focus on open (`data-autofocus`
 * is what the overlay's focus trap looks for), ↑ ↓ move a highlight through the
 * list and Enter picks — a dispatcher reassigning a batch never has to reach
 * for the mouse. The list is a real `listbox` driven by `aria-activedescendant`
 * so the highlighted row is announced without focus leaving the input.
 *
 * With an empty filter, routes are ordered by what this operator has been
 * working on (`lib/recents`) rather than by id, because the route you just
 * assigned five tasks to is nearly always the next one you want.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Modal, TextInput, cx } from '@/components/ui';
import { formatDate, weekdayLabel } from '@/components/domain';
import { boost, recordUse } from '@/lib/recents';
import type { Employee, Route } from '@/types/domain';
import { driverLabel, matchesQuery, routeLabel, taskProgress } from '../utils';
import { AsyncPanel } from './display';

export interface PickerRowProps {
  id: string;
  /** Position in the list, used by the keyboard scroll-into-view lookup. */
  index: number;
  title: string;
  meta: ReactNode;
  onSelect: () => void;
  onHover: () => void;
  disabled?: boolean;
  selected?: boolean;
  active?: boolean;
  /**
   * Optional action rendered on the right (e.g. an "Asignează" button). Its
   * clicks are stopped from reaching the row, so an explicit button press
   * fires the action once rather than once per handler.
   *
   * Hidden from assistive tech, and it must not be focusable — pass
   * `tabIndex={-1}`. A `role="option"` may not contain interactive
   * descendants, and this action only duplicates what activating the row
   * already does, so exposing it twice would be noise rather than help.
   * Keyboard users reach it through the list's own ↑ ↓ / Enter.
   */
  trailing?: ReactNode;
}

export function PickerRow({
  id,
  index,
  title,
  meta,
  onSelect,
  onHover,
  disabled,
  selected,
  active,
  trailing,
}: PickerRowProps) {
  return (
    <div
      id={id}
      data-index={index}
      role="option"
      aria-selected={Boolean(selected)}
      aria-disabled={disabled || undefined}
      onMouseEnter={onHover}
      onMouseDown={(event) => event.preventDefault()}
      onClick={disabled ? undefined : onSelect}
      className={cx(
        'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
        active && !disabled ? 'border-brand-500 bg-brand-50' : 'border-border bg-white',
        selected && !active && 'border-brand-300 bg-brand-50/50',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-surface-sunken',
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">{meta}</span>
      </span>
      {trailing && (
        <span
          className="shrink-0"
          aria-hidden="true"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {trailing}
        </span>
      )}
    </div>
  );
}

/**
 * Shared list-keyboard behaviour for the pickers and for AssignRecurringModal:
 * a highlight that resets when the filter changes, stays inside the list,
 * scrolls into view, and commits on Enter.
 */
export function useListKeyboard<T>(items: T[], onPick: (item: T) => void) {
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight > items.length - 1) setHighlight(Math.max(0, items.length - 1));
  }, [items.length, highlight]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => (current + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => (current - 1 + items.length) % items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[highlight];
      if (item !== undefined) onPick(item);
    }
  };

  return { highlight, setHighlight, listRef, onKeyDown };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export interface RoutePickerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  routes: Route[] | undefined;
  isPending: boolean;
  error: unknown;
  /** Route already in use — shown disabled so the choice is obvious. */
  excludeRouteId?: number | null;
  busy?: boolean;
  onSelect: (route: Route) => void;
}

export function RoutePickerModal({
  open,
  onClose,
  title,
  subtitle,
  routes,
  isPending,
  error,
  excludeRouteId = null,
  busy = false,
  onSelect,
}: RoutePickerModalProps) {
  const [query, setQuery] = useState('');
  const listId = 'route-picker-list';

  const filtered = useMemo(() => {
    const list = (routes ?? []).filter((route) =>
      matchesQuery(query, routeLabel(route), route.county, route.employee?.fullName),
    );
    if (query.trim()) return list;
    // Empty filter: most recently worked-on routes first.
    return [...list].sort(
      (left, right) =>
        boost('route', right.id) - boost('route', left.id) ||
        (left.date ?? '').localeCompare(right.date ?? ''),
    );
  }, [routes, query]);

  const pick = (route: Route) => {
    if (busy || route.id === excludeRouteId) return;
    recordUse('route', route.id);
    onSelect(route);
  };

  const { highlight, setHighlight, listRef, onKeyDown } = useListKeyboard(filtered, pick);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Închide
        </Button>
      }
    >
      {subtitle && <p className="mb-3 text-sm text-ink-muted">{subtitle}</p>}

      <TextInput
        data-autofocus
        placeholder="Caută rută, județ sau șofer…  (↑↓ și Enter)"
        aria-label="Caută rută"
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={filtered[highlight] ? `${listId}-${highlight}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
      />

      <div ref={listRef} className="mt-3 max-h-80 overflow-y-auto">
        <AsyncPanel
          isPending={isPending}
          error={error}
          isEmpty={filtered.length === 0}
          emptyTitle="Nicio rută"
          emptyBody="Creează întâi o rută în ecranul Rute."
        >
          <div id={listId} role="listbox" aria-label="Rute" className="flex flex-col gap-1.5">
            {filtered.map((route, index) => {
              const progress = taskProgress(route.tasks);
              return (
                <PickerRow
                  key={route.id}
                  id={`${listId}-${index}`}
                  index={index}
                  title={routeLabel(route)}
                  meta={[
                    formatDate(route.date),
                    weekdayLabel(route.dayOfWeek),
                    route.county ?? 'fără județ',
                    driverLabel(route.employee),
                    `${progress.total} sarcini`,
                  ].join(' · ')}
                  disabled={busy || route.id === excludeRouteId}
                  active={index === highlight}
                  onHover={() => setHighlight(index)}
                  onSelect={() => pick(route)}
                />
              );
            })}
          </div>
        </AsyncPanel>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export interface DriverPickerModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: ReactNode;
  drivers: Employee[] | undefined;
  isPending: boolean;
  error: unknown;
  currentDriverId?: number | null;
  busy?: boolean;
  onSelect: (driver: Employee) => void;
}

export function DriverPickerModal({
  open,
  onClose,
  title = 'Alege șoferul',
  subtitle,
  drivers,
  isPending,
  error,
  currentDriverId = null,
  busy = false,
  onSelect,
}: DriverPickerModalProps) {
  const [query, setQuery] = useState('');
  const listId = 'driver-picker-list';

  const filtered = useMemo(
    () =>
      (drivers ?? []).filter((driver) =>
        matchesQuery(query, driver.fullName, driver.username, driver.county, driver.phone),
      ),
    [drivers, query],
  );

  const pick = (driver: Employee) => {
    if (busy) return;
    onSelect(driver);
  };

  const { highlight, setHighlight, listRef, onKeyDown } = useListKeyboard(filtered, pick);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Închide
        </Button>
      }
    >
      {subtitle && <p className="mb-3 text-sm text-ink-muted">{subtitle}</p>}

      <TextInput
        data-autofocus
        placeholder="Caută șofer…  (↑↓ și Enter)"
        aria-label="Caută șofer"
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={filtered[highlight] ? `${listId}-${highlight}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
      />

      <div ref={listRef} className="mt-3 max-h-80 overflow-y-auto">
        <AsyncPanel
          isPending={isPending}
          error={error}
          isEmpty={filtered.length === 0}
          emptyTitle="Niciun șofer"
          emptyBody="Nu există angajați cu rolul de șofer."
        >
          <div id={listId} role="listbox" aria-label="Șoferi" className="flex flex-col gap-1.5">
            {filtered.map((driver, index) => (
              <PickerRow
                key={driver.id}
                id={`${listId}-${index}`}
                index={index}
                title={driver.fullName}
                meta={[driver.phone ?? 'fără telefon', driver.county ?? 'fără județ'].join(' · ')}
                selected={driver.id === currentDriverId}
                active={index === highlight}
                disabled={busy}
                onHover={() => setHighlight(index)}
                onSelect={() => pick(driver)}
              />
            ))}
          </div>
        </AsyncPanel>
      </div>
    </Modal>
  );
}
