/**
 * Route and driver pickers.
 *
 * Both are used from several screens (bulk reassign, drag-in fallback, driver
 * change, recurring assignment), so they live here rather than in a page.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Modal, TextInput } from '@/components/ui';
import { formatDate, weekdayLabel } from '@/components/domain';
import type { Employee, Route } from '@/types/domain';
import { driverLabel, matchesQuery, routeLabel, taskProgress } from '../utils';
import { AsyncPanel } from './display';

interface PickerRowProps {
  title: string;
  meta: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  selected?: boolean;
}

function PickerRow({ title, meta, onSelect, disabled, selected }: PickerRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={[
        'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
        selected ? 'border-brand-500 bg-brand-50' : 'border-border bg-white hover:bg-surface-sunken',
        disabled && 'cursor-not-allowed opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">{meta}</span>
      </span>
    </button>
  );
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

  const filtered = useMemo(() => {
    const list = routes ?? [];
    return list.filter((route) =>
      matchesQuery(query, routeLabel(route), route.county, route.employee?.fullName),
    );
  }, [routes, query]);

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
        placeholder="Caută rută, județ sau șofer…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="mt-3 max-h-80 overflow-y-auto">
        <AsyncPanel
          isPending={isPending}
          error={error}
          isEmpty={filtered.length === 0}
          emptyTitle="Nicio rută"
          emptyBody="Creează întâi o rută în ecranul Rute."
        >
          <div className="flex flex-col gap-1.5">
            {filtered.map((route) => {
              const progress = taskProgress(route.tasks);
              return (
                <PickerRow
                  key={route.id}
                  title={routeLabel(route)}
                  meta={[
                    formatDate(route.date),
                    weekdayLabel(route.dayOfWeek),
                    route.county ?? 'fără județ',
                    driverLabel(route.employee),
                    `${progress.total} sarcini`,
                  ].join(' · ')}
                  disabled={busy || route.id === excludeRouteId}
                  onSelect={() => onSelect(route)}
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

  const filtered = useMemo(() => {
    const list = drivers ?? [];
    return list.filter((driver) =>
      matchesQuery(query, driver.fullName, driver.username, driver.county, driver.phone),
    );
  }, [drivers, query]);

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
        placeholder="Caută șofer…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="mt-3 max-h-80 overflow-y-auto">
        <AsyncPanel
          isPending={isPending}
          error={error}
          isEmpty={filtered.length === 0}
          emptyTitle="Niciun șofer"
          emptyBody="Nu există angajați cu rolul de șofer."
        >
          <div className="flex flex-col gap-1.5">
            {filtered.map((driver) => (
              <PickerRow
                key={driver.id}
                title={driver.fullName}
                meta={[driver.phone ?? 'fără telefon', driver.county ?? 'fără județ'].join(' · ')}
                selected={driver.id === currentDriverId}
                disabled={busy}
                onSelect={() => onSelect(driver)}
              />
            ))}
          </div>
        </AsyncPanel>
      </div>
    </Modal>
  );
}
