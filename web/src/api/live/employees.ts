/**
 * EmployeeController — /api/employees        (reads, any authenticated user)
 * AdminController    — /api/admin/employees   (writes, requires an admin role
 *                       on the caller's access token — see src/api/http.ts)
 *
 * Two traps here:
 *  1. The read endpoints return the JPA *entity*, whose `roles` is a list of
 *     `EmployeeRole` objects (`{id, roleName}`). The admin endpoints return the
 *     EmployeeResponse DTO, whose `roles` is a list of plain strings.
 *     normalizeEmployee() flattens both to Role[].
 *  2. The write DTO calls the field `roleNames`, not `roles`. Sending `roles`
 *     silently creates an employee with no roles at all.
 */

import type { CreateEmployeeInput, EmployeesApi } from '../contract';
import type { Employee, Role } from '@/types/domain';
import { request } from '../http';
import { normalizeEmployee, type RawEmployee } from './normalize';

interface CreateEmployeeBody {
  username?: string;
  password?: string;
  fullName?: string;
  phone?: string | null;
  county?: string | null;
  roleNames?: Role[];
}

function toCreateBody(input: Partial<CreateEmployeeInput>): CreateEmployeeBody {
  const { roles, ...rest } = input;
  const body: CreateEmployeeBody = { ...rest };
  // AdminService ignores an empty/absent roleNames on update (roles are left
  // untouched), so only send it when there is something to say.
  if (roles && roles.length > 0) body.roleNames = roles;
  return body;
}

/** Shared by routes.ts, which has to rehydrate `Route.employee` by hand. */
export async function fetchEmployeeMap(): Promise<Map<number, Employee>> {
  const map = new Map<number, Employee>();
  try {
    const raw = await request<RawEmployee[]>('/employees');
    for (const entry of raw ?? []) {
      const employee = normalizeEmployee(entry);
      map.set(employee.id, employee);
    }
  } catch {
    // Hydration is a nicety; a route with a partially-known driver still
    // renders. Never let this failure sink the caller's request.
  }
  return map;
}

export const employeesApi: EmployeesApi = {
  async list(): Promise<Employee[]> {
    const raw = await request<RawEmployee[]>('/employees');
    return (raw ?? []).map(normalizeEmployee);
  },

  async get(id: number): Promise<Employee> {
    return normalizeEmployee(await request<RawEmployee>(`/employees/${id}`));
  },

  async listDrivers(): Promise<Employee[]> {
    const raw = await request<RawEmployee[]>('/employees/drivers');
    return (raw ?? []).map(normalizeEmployee);
  },

  async listByRole(role: Role): Promise<Employee[]> {
    // Server-side match is case-insensitive, but keep the canonical casing.
    const raw = await request<RawEmployee[]>(`/employees/role/${encodeURIComponent(role)}`);
    return (raw ?? []).map(normalizeEmployee);
  },

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const raw = await request<RawEmployee>('/admin/employees', {
      method: 'POST',
      body: toCreateBody(input),
    });
    return normalizeEmployee(raw);
  },

  async update(id: number, input: Partial<CreateEmployeeInput>): Promise<Employee> {
    const raw = await request<RawEmployee>(`/admin/employees/${id}`, {
      method: 'PUT',
      body: toCreateBody(input),
    });
    return normalizeEmployee(raw);
  },

  async remove(id: number): Promise<void> {
    // Answers 200 with {message}, not 204 — request() tolerates both.
    await request<void>(`/admin/employees/${id}`, { method: 'DELETE' });
  },
};
