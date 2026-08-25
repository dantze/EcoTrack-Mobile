/**
 * RecurringIgienizareController — /api/recurring-igienizari
 *
 * Unlike Task and Route, this entity serialises its associations in full:
 * `client`, `subscription` and `route` all arrive nested (the nested route
 * still hides its employee behind employeeId/employeeName, hence the roster
 * fetch). Notable server behaviour:
 *   - PUT /{id}/assign-route takes {routeId} and, as a side effect, generates
 *     the plan's tasks onto that route (90 days ahead for indefinite plans).
 *   - PUT /{id}/deactivate flips `active` AND deletes every non-completed task
 *     the plan generated.
 *   - POST /client/{clientId} also creates a companion IgienizareOrder, so a
 *     new plan makes the orders list stale too.
 *   - /unassigned means active AND route IS NULL — deactivated plans without a
 *     route do not appear.
 */

import type { RecurringApi } from '../contract';
import type { RecurringIgienizare } from '@/types/domain';
import { request } from '../http';
import { fetchEmployeeMap } from './employees';
import { normalizeRecurring, type RawRecurring } from './normalize';

async function listWith(path: string): Promise<RecurringIgienizare[]> {
  const [raw, employees] = await Promise.all([
    request<RawRecurring[]>(path),
    fetchEmployeeMap(),
  ]);
  return (raw ?? []).map((plan) => normalizeRecurring(plan, { employees }));
}

async function oneWith(fetchRaw: () => Promise<RawRecurring>): Promise<RecurringIgienizare> {
  const [raw, employees] = await Promise.all([fetchRaw(), fetchEmployeeMap()]);
  return normalizeRecurring(raw, { employees });
}

export const recurringApi: RecurringApi = {
  list(): Promise<RecurringIgienizare[]> {
    return listWith('/recurring-igienizari');
  },

  listActive(): Promise<RecurringIgienizare[]> {
    return listWith('/recurring-igienizari/active');
  },

  listUnassigned(): Promise<RecurringIgienizare[]> {
    return listWith('/recurring-igienizari/unassigned');
  },

  get(id: number): Promise<RecurringIgienizare> {
    return oneWith(() => request<RawRecurring>(`/recurring-igienizari/${id}`));
  },

  listForClient(clientId: number): Promise<RecurringIgienizare[]> {
    return listWith(`/recurring-igienizari/client/${clientId}`);
  },

  create(clientId: number, input: Partial<RecurringIgienizare>): Promise<RecurringIgienizare> {
    // The body is bound onto the entity: `subscription` and `route` are
    // resolved by their nested id, so pass the objects (or `{id}` stubs)
    // rather than bare foreign keys.
    return oneWith(() =>
      request<RawRecurring>(`/recurring-igienizari/client/${clientId}`, {
        method: 'POST',
        body: input,
      }),
    );
  },

  assignRoute(id: number, routeId: number): Promise<RecurringIgienizare> {
    return oneWith(() =>
      request<RawRecurring>(`/recurring-igienizari/${id}/assign-route`, {
        method: 'PUT',
        body: { routeId },
      }),
    );
  },

  deactivate(id: number): Promise<RecurringIgienizare> {
    return oneWith(() =>
      request<RawRecurring>(`/recurring-igienizari/${id}/deactivate`, { method: 'PUT' }),
    );
  },
};
