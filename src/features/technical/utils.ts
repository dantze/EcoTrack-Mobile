/**
 * Small pure helpers shared by the Technical screens.
 *
 * Anything that formats a backend enum belongs in `@/components/domain`, not
 * here — this file is only for dispatch-specific derivations.
 */

import { ApiError } from '@/api';
import type { Employee, Route, Task } from '@/types/domain';
import { FREQUENCY_LABELS } from './constants';

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Local (not UTC) ISO date, "YYYY-MM-DD" — the format every endpoint expects. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function shiftIsoDate(iso: string, days: number): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  parsed.setDate(parsed.getDate() + days);
  return toIsoDate(parsed);
}

/** The scheduled date of a task, falling back to the date part of scheduledTime. */
export function taskDate(task: Task): string | null {
  if (task.scheduledDate) return task.scheduledDate;
  if (task.scheduledTime) return task.scheduledTime.slice(0, 10);
  return null;
}

const timeFormatter = new Intl.DateTimeFormat('ro-RO', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '—' : timeFormatter.format(parsed);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function routeLabel(route: Pick<Route, 'id' | 'name'> | null | undefined): string {
  if (!route) return 'Neasignat';
  return route.name?.trim() ? route.name : `Ruta #${route.id}`;
}

export function driverLabel(employee: Employee | null | undefined): string {
  return employee?.fullName?.trim() ? employee.fullName : 'Fără șofer';
}

export function frequencyLabel(days: number): string {
  return FREQUENCY_LABELS[days] ?? `La ${days} zile`;
}

/** Frequency stated as a plan interval, e.g. "Lunar (30 zile)". */
export function frequencyDetail(days: number): string {
  const known = FREQUENCY_LABELS[days];
  return known ? `${known} (${days} zile)` : `La ${days} zile`;
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

export interface Progress {
  total: number;
  done: number;
  inProgress: number;
  /** 0–100, 0 when there are no tasks. */
  percent: number;
}

export function taskProgress(tasks: readonly Task[] | null | undefined): Progress {
  const list = tasks ?? [];
  const done = list.filter((task) => task.status === 'COMPLETED').length;
  const inProgress = list.filter((task) => task.status === 'IN_PROGRESS').length;
  return {
    total: list.length,
    done,
    inProgress,
    percent: list.length === 0 ? 0 : Math.round((done / list.length) * 100),
  };
}

/** Route tasks come back unsorted often enough that every screen sorts them. */
export function byOrderIndex(left: Task, right: Task): number {
  if (left.orderIndex !== right.orderIndex) return left.orderIndex - right.orderIndex;
  return left.id - right.id;
}

export function sortByOrderIndex(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(byOrderIndex);
}

export function isUnassigned(task: Task): boolean {
  return task.route === null || task.route === undefined;
}

/** Case-insensitive, diacritic-tolerant "does this row match the search box". */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = normalise(query);
  if (!needle) return true;
  return fields.some((field) => normalise(field ?? '').includes(needle));
}

const DIACRITICS = /[\u0300-\u036f]/g;

function normalise(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** True for the 401/403 the backend returns when X-Admin-Key is missing/wrong. */
export function isAdminAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export const ADMIN_KEY_MESSAGE =
  'Operațiunile pe angajați necesită cheia de administrator (VITE_ADMIN_KEY). ' +
  'Cheia lipsește sau este invalidă, așa că serverul a refuzat cererea.';

/** A Romanian, user-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (isAdminAuthError(error)) return ADMIN_KEY_MESSAGE;
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Resursa nu a fost găsită pe server.';
    if (error.status >= 500) return 'Serverul a returnat o eroare. Încearcă din nou.';
    return `Cererea a eșuat (cod ${error.status}).`;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'A apărut o eroare neașteptată.';
}
