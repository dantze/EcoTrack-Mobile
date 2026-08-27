/**
 * Server state for the Admin module.
 *
 * Namespaced under 'admin' like the other modules, so invalidating the root
 * key refreshes both the request queue and the employee roster — which matters
 * because approving a request CREATES an employee, so the two are never
 * independent.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { api } from '@/api';
import type { AccessRequest } from '@/api/contract';
import type { Employee, Role } from '@/types/domain';

export const keys = {
  root: ['admin'] as const,
  requests: () => ['admin', 'requests'] as const,
  employees: () => ['admin', 'employees'] as const,
};

/**
 * The pending queue. Polled: a request arrives while the admin is already
 * looking at the screen, and it expires on its own after ten minutes, so a
 * stale list is actively misleading here.
 */
export function useAccessRequests(): UseQueryResult<AccessRequest[]> {
  return useQuery({
    queryKey: keys.requests(),
    queryFn: () => api.enrollment.listRequests(),
    refetchInterval: 5000,
  });
}

export function useApproveRequest(): UseMutationResult<void, unknown, { id: number; role: Role }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }) => api.enrollment.approve(id, role),
    // Approval creates the Employee, so the roster is dirty too.
    onSuccess: () => client.invalidateQueries({ queryKey: keys.root }),
  });
}

export function useRejectRequest(): UseMutationResult<void, unknown, number> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.enrollment.reject(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.requests() }),
  });
}

export function useAllEmployees(): UseQueryResult<Employee[]> {
  return useQuery({
    queryKey: keys.employees(),
    queryFn: () => api.employees.list(),
  });
}

export function useSetEmployeeRoles(): UseMutationResult<
  Employee,
  unknown,
  { id: number; roles: Role[] }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roles }) => api.employees.update(id, { roles }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.root }),
  });
}

export function useRemoveEmployee(): UseMutationResult<void, unknown, number> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.employees.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.root }),
  });
}
