/**
 * TanStack Query bindings for the "Sesiuni active" panel (src/features/auth).
 * Mirrors the convention in src/features/sales/queries.ts and
 * src/features/technical/queries.ts: one file, hierarchical keys, every
 * mutation invalidates the list it affects.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/api';
import type { SessionDevice } from '@/api/contract';

export const authKeys = {
  sessions: ['auth', 'sessions'] as const,
};

export function useSessions(enabled: boolean): UseQueryResult<SessionDevice[]> {
  return useQuery({
    queryKey: authKeys.sessions,
    queryFn: () => api.auth.listSessions(),
    enabled,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.auth.revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.sessions }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.revokeOtherSessions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.sessions }),
  });
}
