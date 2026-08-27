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

/**
 * Monday of the week containing `from`, as ISO.
 *
 * Weeks start Monday here because that is how the Romanian working week — and
 * `Route.dayOfWeek` (1 = Monday, per java.time.DayOfWeek) — is numbered.
 */
export function weekStartIso(from: Date = new Date()): string {
  const date = new Date(from);
  const jsDay = date.getDay(); // 0 = Sunday
  const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return toIsoDate(date);
}

/** Inclusive [Monday, Sunday] of the week `offsetWeeks` from the current one. */
export function weekRange(offsetWeeks = 0): { from: string; to: string } {
  const monday = new Date(`${weekStartIso()}T00:00:00`);
  monday.setDate(monday.getDate() + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return { from: toIsoDate(monday), to: toIsoDate(sunday) };
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

/** True for the 401/403 the backend returns when the caller's role lacks admin rights. */
export function isAdminAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export const ADMIN_FORBIDDEN_MESSAGE =
  'Operațiunile pe angajați necesită drepturi de administrator. ' +
  'Contul tău nu are drepturile necesare, așa că serverul a refuzat cererea.';

/** A Romanian, user-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (isAdminAuthError(error)) return ADMIN_FORBIDDEN_MESSAGE;
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Resursa nu a fost găsită pe server.';
    if (error.status >= 500) return 'Serverul a returnat o eroare. Încearcă din nou.';
    return `Cererea a eșuat (cod ${error.status}).`;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'A apărut o eroare neașteptată.';
}

// ---------------------------------------------------------------------------
// Failed-submit focus
// ---------------------------------------------------------------------------

/**
 * Moves focus to the first field named in `errors`, keyed by that field's DOM
 * `id` — a failed submit should land the cursor on the problem, not just toast
 * about it. Only reaches `TextInput`/`TextArea` fields: `Select` and
 * `DateInput` do not accept an explicit `id` from the UI kit today, so a key
 * that names one of those simply finds no element and no-ops. The inline error
 * text under the field still renders either way.
 *
 * Reads through `Object.entries` (rather than typing the parameter as
 * `Record<string, string | undefined>` directly) so callers can pass their own
 * named `Errors` interface without needing an index signature on it.
 */
export function focusFirstInvalidField(errors: object): void {
  const [key] = Object.entries(errors).find(
    ([, message]) => typeof message === 'string' && message,
  ) ?? [];
  if (!key) return;
  requestAnimationFrame(() => {
    document.getElementById(key)?.focus();
  });
}
