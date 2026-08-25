/**
 * RouteController — /api/routes
 *
 * Traps:
 *  - `Route.employee` is @JsonIgnore. The wire carries only the transient
 *    `employeeId` / `employeeName`, so every read here fetches the employee
 *    roster once and rehydrates `Route.employee` from it (falling back to a
 *    name-only stub if that lookup fails).
 *  - PUT /routes/{routeId}/reorder-tasks takes a BARE JSON ARRAY of task ids,
 *    not `{taskIds: [...]}`.
 *  - DELETE unassigns the route's tasks and recurring plans rather than
 *    cascading the delete into them.
 */

import type { CreateRouteInput, RoutesApi } from '../contract';
import type { Employee, Route } from '@/types/domain';
import { request } from '../http';
import { fetchEmployeeMap } from './employees';
import { normalizeRoute, type RawRoute } from './normalize';

/** Runs the route call and the roster fetch in parallel, then pairs them up. */
async function withEmployees<T>(
  fetchRaw: () => Promise<T>,
): Promise<{ raw: T; employees: Map<number, Employee> }> {
  const [raw, employees] = await Promise.all([fetchRaw(), fetchEmployeeMap()]);
  return { raw, employees };
}

export const routesApi: RoutesApi = {
  async list(): Promise<Route[]> {
    const { raw, employees } = await withEmployees(() => request<RawRoute[]>('/routes'));
    return (raw ?? []).map((route) => normalizeRoute(route, { employees }));
  },

  async get(id: number): Promise<Route> {
    const { raw, employees } = await withEmployees(() => request<RawRoute>(`/routes/${id}`));
    return normalizeRoute(raw, { employees });
  },

  async listForEmployee(employeeId: number): Promise<Route[]> {
    const { raw, employees } = await withEmployees(() =>
      request<RawRoute[]>(`/routes/employee/${employeeId}`),
    );
    return (raw ?? []).map((route) => normalizeRoute(route, { employees }));
  },

  async listForEmployeeOnDate(employeeId: number, date: string): Promise<Route[]> {
    const { raw, employees } = await withEmployees(() =>
      request<RawRoute[]>(`/routes/employee/${employeeId}/date/${date}`),
    );
    return (raw ?? []).map((route) => normalizeRoute(route, { employees }));
  },

  async create(input: CreateRouteInput): Promise<Route> {
    const { raw, employees } = await withEmployees(() =>
      request<RawRoute>('/routes', { method: 'POST', body: input }),
    );
    return normalizeRoute(raw, { employees });
  },

  async remove(id: number): Promise<void> {
    await request<void>(`/routes/${id}`, { method: 'DELETE' });
  },

  async assignDriver(routeId: number, employeeId: number): Promise<Route> {
    const { raw, employees } = await withEmployees(() =>
      request<RawRoute>(`/routes/${routeId}/assign-driver/${employeeId}`, { method: 'PUT' }),
    );
    return normalizeRoute(raw, { employees });
  },

  async reorderTasks(routeId: number, taskIds: number[]): Promise<Route> {
    const { raw, employees } = await withEmployees(() =>
      // Bare array body — deliberately NOT wrapped in an object.
      request<RawRoute>(`/routes/${routeId}/reorder-tasks`, { method: 'PUT', body: taskIds }),
    );
    return normalizeRoute(raw, { employees });
  },
};
