/**
 * Server state for the Technical module.
 *
 * All query keys live here so invalidation is predictable: every key starts
 * with 'technical', and the nested shapes mean invalidating a parent key
 * (e.g. `keys.routes()`) also refreshes the per-route task lists underneath it.
 *
 * Mutations are exposed as hooks that already invalidate what they dirty;
 * screens only supply the success/error toasts.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { api } from '@/api';
import type { CreateEmployeeInput, CreateRouteInput } from '@/api';
import type {
  Employee,
  RecurringIgienizare,
  Route,
  Task,
  TaskPhoto,
  TaskStatus,
} from '@/types/domain';

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export type RecurringScope = 'all' | 'active' | 'unassigned';

export const keys = {
  root: ['technical'] as const,

  routes: () => ['technical', 'routes'] as const,
  routeTasks: (routeId: number) => ['technical', 'routes', routeId, 'tasks'] as const,

  tasks: () => ['technical', 'tasks'] as const,
  task: (taskId: number) => ['technical', 'tasks', taskId, 'detail'] as const,
  taskPhotos: (taskId: number) => ['technical', 'tasks', taskId, 'photos'] as const,

  drivers: () => ['technical', 'drivers'] as const,
  driverRoutes: (employeeId: number) => ['technical', 'drivers', employeeId, 'routes'] as const,
  driverTasks: (employeeId: number) => ['technical', 'drivers', employeeId, 'tasks'] as const,

  recurring: (scope: RecurringScope) => ['technical', 'recurring', scope] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * `enabled` lets the shell's command palette subscribe to the same keys without
 * firing requests a Sales-only account is not allowed to make.
 */
export interface ReadOptions {
  enabled?: boolean;
}

export function useRoutes({ enabled = true }: ReadOptions = {}): UseQueryResult<Route[]> {
  return useQuery({ queryKey: keys.routes(), queryFn: () => api.routes.list(), enabled });
}

export function useRouteTasks(routeId: number | null): UseQueryResult<Task[]> {
  return useQuery({
    queryKey: keys.routeTasks(routeId ?? -1),
    queryFn: () => api.tasks.listForRoute(routeId as number),
    enabled: routeId !== null,
  });
}

export function useTasks({ enabled = true }: ReadOptions = {}): UseQueryResult<Task[]> {
  return useQuery({ queryKey: keys.tasks(), queryFn: () => api.tasks.list(), enabled });
}

/** Full record for the detail drawer — the list rows are not guaranteed deep. */
export function useTask(taskId: number | null): UseQueryResult<Task> {
  return useQuery({
    queryKey: keys.task(taskId ?? -1),
    queryFn: () => api.tasks.get(taskId as number),
    enabled: taskId !== null,
  });
}

export function useDrivers(): UseQueryResult<Employee[]> {
  return useQuery({ queryKey: keys.drivers(), queryFn: () => api.employees.listDrivers() });
}

export function useDriverRoutes(employeeId: number | null): UseQueryResult<Route[]> {
  return useQuery({
    queryKey: keys.driverRoutes(employeeId ?? -1),
    queryFn: () => api.routes.listForEmployee(employeeId as number),
    enabled: employeeId !== null,
  });
}

export function useDriverTasks(employeeId: number | null): UseQueryResult<Task[]> {
  return useQuery({
    queryKey: keys.driverTasks(employeeId ?? -1),
    queryFn: () => api.tasks.listForEmployee(employeeId as number),
    enabled: employeeId !== null,
  });
}

export function useTaskPhotos(taskId: number | null): UseQueryResult<TaskPhoto[]> {
  return useQuery({
    queryKey: keys.taskPhotos(taskId ?? -1),
    queryFn: () => api.tasks.listPhotos(taskId as number),
    enabled: taskId !== null,
  });
}

export function useRecurring(scope: RecurringScope): UseQueryResult<RecurringIgienizare[]> {
  return useQuery({
    queryKey: keys.recurring(scope),
    queryFn: () => {
      if (scope === 'unassigned') return api.recurring.listUnassigned();
      if (scope === 'active') return api.recurring.listActive();
      return api.recurring.list();
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations — routes
// ---------------------------------------------------------------------------

/** Everything a route write can touch: the list, its tasks, and driver views. */
function useRouteInvalidation() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: keys.routes() });
    void client.invalidateQueries({ queryKey: keys.tasks() });
    void client.invalidateQueries({ queryKey: keys.drivers() });
  };
}

export function useCreateRoute(): UseMutationResult<Route, unknown, CreateRouteInput> {
  const invalidate = useRouteInvalidation();
  return useMutation({
    mutationFn: (input: CreateRouteInput) => api.routes.create(input),
    onSuccess: invalidate,
  });
}

export function useDeleteRoute(): UseMutationResult<void, unknown, number> {
  const invalidate = useRouteInvalidation();
  return useMutation({
    mutationFn: (routeId: number) => api.routes.remove(routeId),
    onSuccess: invalidate,
  });
}

export interface AssignDriverVars {
  routeId: number;
  employeeId: number;
}

export function useAssignDriver(): UseMutationResult<Route, unknown, AssignDriverVars> {
  const invalidate = useRouteInvalidation();
  return useMutation({
    mutationFn: ({ routeId, employeeId }: AssignDriverVars) =>
      api.routes.assignDriver(routeId, employeeId),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Mutations — task ordering and assignment
// ---------------------------------------------------------------------------

interface ReorderContext {
  previous: Task[] | undefined;
}

/**
 * Drag-to-reorder inside a route.
 *
 * Optimistic on purpose: the mock layer answers in ~220ms and the list must
 * not visibly snap back to the old order in the meantime. The cache is
 * rewritten in the dropped order (with recomputed orderIndex) before the
 * request goes out, and rolled back only if the server rejects it.
 */
export function useReorderRouteTasks(
  routeId: number,
): UseMutationResult<Route, unknown, number[], ReorderContext> {
  const client = useQueryClient();
  const key = keys.routeTasks(routeId);

  return useMutation<Route, unknown, number[], ReorderContext>({
    mutationFn: (taskIds: number[]) => api.routes.reorderTasks(routeId, taskIds),
    onMutate: async (taskIds) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Task[]>(key);
      if (previous) {
        const byId = new Map(previous.map((task) => [task.id, task]));
        const reordered = taskIds.flatMap((id, index) => {
          const task = byId.get(id);
          return task ? [{ ...task, orderIndex: index }] : [];
        });
        client.setQueryData<Task[]>(key, reordered);
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData<Task[]>(key, context.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: keys.routes() });
    },
  });
}

export interface MoveTaskVars {
  task: Task;
  /** Full desired order of the target route, including the moved task. */
  orderedIds: number[];
}

interface MoveContext {
  previousRouteTasks: Task[] | undefined;
  previousAllTasks: Task[] | undefined;
}

/**
 * Drag an unassigned task onto a route: reassign it, then persist the order it
 * was dropped into. Two calls because the contract has no "assign at position".
 */
export function useMoveTaskToRoute(
  route: Route | null,
): UseMutationResult<void, unknown, MoveTaskVars, MoveContext> {
  const client = useQueryClient();
  const routeId = route?.id ?? -1;
  const routeKey = keys.routeTasks(routeId);
  const tasksKey = keys.tasks();

  return useMutation<void, unknown, MoveTaskVars, MoveContext>({
    mutationFn: async ({ task, orderedIds }) => {
      await api.tasks.reassign(task.id, routeId);
      await api.routes.reorderTasks(routeId, orderedIds);
    },
    onMutate: async ({ task, orderedIds }) => {
      await Promise.all([
        client.cancelQueries({ queryKey: routeKey }),
        client.cancelQueries({ queryKey: tasksKey }),
      ]);

      const previousRouteTasks = client.getQueryData<Task[]>(routeKey);
      const previousAllTasks = client.getQueryData<Task[]>(tasksKey);
      const moved: Task = { ...task, route };

      if (previousRouteTasks) {
        const byId = new Map([...previousRouteTasks, moved].map((item) => [item.id, item]));
        const reordered = orderedIds.flatMap((id, index) => {
          const item = byId.get(id);
          return item ? [{ ...item, orderIndex: index }] : [];
        });
        client.setQueryData<Task[]>(routeKey, reordered);
      }

      if (previousAllTasks) {
        const position = orderedIds.indexOf(task.id);
        client.setQueryData<Task[]>(
          tasksKey,
          previousAllTasks.map((item) =>
            item.id === task.id
              ? { ...moved, orderIndex: position < 0 ? item.orderIndex : position }
              : item,
          ),
        );
      }

      return { previousRouteTasks, previousAllTasks };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousRouteTasks) {
        client.setQueryData<Task[]>(routeKey, context.previousRouteTasks);
      }
      if (context?.previousAllTasks) {
        client.setQueryData<Task[]>(tasksKey, context.previousAllTasks);
      }
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: routeKey });
      void client.invalidateQueries({ queryKey: tasksKey });
      void client.invalidateQueries({ queryKey: keys.routes() });
    },
  });
}

export interface AssignGroupVars {
  taskIds: number[];
  /** Full desired order of the target route once the batch has landed. */
  orderedIds: number[];
}

/**
 * Accepting a suggested group: move a batch of unassigned tasks onto one route
 * and immediately persist the driving order they were proposed in.
 *
 * Two calls, same as `useMoveTaskToRoute`, because the contract has no
 * "assign at positions" endpoint. Not optimistic: this writes several rows at
 * once from a suggestion, and showing the real result is worth the round trip.
 */
export function useAssignTasksToRoute(
  routeId: number,
): UseMutationResult<void, unknown, AssignGroupVars> {
  const client = useQueryClient();
  return useMutation<void, unknown, AssignGroupVars>({
    mutationFn: async ({ taskIds, orderedIds }) => {
      await api.tasks.reassignMany(taskIds, routeId);
      await api.routes.reorderTasks(routeId, orderedIds);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.routeTasks(routeId) });
      void client.invalidateQueries({ queryKey: keys.tasks() });
      void client.invalidateQueries({ queryKey: keys.routes() });
      void client.invalidateQueries({ queryKey: keys.drivers() });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations — tasks
// ---------------------------------------------------------------------------

function useTaskInvalidation() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: keys.tasks() });
    void client.invalidateQueries({ queryKey: keys.routes() });
    void client.invalidateQueries({ queryKey: keys.drivers() });
  };
}

export interface UpdateStatusVars {
  taskId: number;
  status: TaskStatus;
}

export function useUpdateTaskStatus(): UseMutationResult<Task, unknown, UpdateStatusVars> {
  const invalidate = useTaskInvalidation();
  return useMutation({
    mutationFn: ({ taskId, status }: UpdateStatusVars) => api.tasks.updateStatus(taskId, status),
    onSuccess: invalidate,
  });
}

export interface UpdateDateVars {
  taskId: number;
  /** ISO date, "YYYY-MM-DD". The server pins the time to 08:00. */
  date: string;
}

export function useUpdateTaskDate(): UseMutationResult<Task, unknown, UpdateDateVars> {
  const invalidate = useTaskInvalidation();
  return useMutation({
    mutationFn: ({ taskId, date }: UpdateDateVars) => api.tasks.updateScheduledDate(taskId, date),
    onSuccess: invalidate,
  });
}

export interface UpdateManyStatusVars {
  taskIds: number[];
  status: TaskStatus;
}

/**
 * Set the same status on a whole selection.
 *
 * The contract has no batch status endpoint (only `PATCH /tasks/{id}/status`),
 * so this fans out sequentially and reports how many landed — a dispatcher
 * closing out a finished route should not have to click through twenty rows.
 * Sequential rather than parallel on purpose: the backend has no optimistic
 * locking (see CLAUDE.md), and hammering it with twenty concurrent writes is
 * the wrong way to find that out.
 */
export function useUpdateManyTaskStatuses(): UseMutationResult<
  { updated: number; failed: number },
  unknown,
  UpdateManyStatusVars
> {
  const invalidate = useTaskInvalidation();
  return useMutation({
    mutationFn: async ({ taskIds, status }: UpdateManyStatusVars) => {
      let updated = 0;
      let failed = 0;
      for (const id of taskIds) {
        try {
          await api.tasks.updateStatus(id, status);
          updated += 1;
        } catch {
          failed += 1;
        }
      }
      return { updated, failed };
    },
    onSuccess: invalidate,
  });
}

export interface ReassignManyVars {
  taskIds: number[];
  routeId: number;
}

export function useReassignTasks(): UseMutationResult<Task[], unknown, ReassignManyVars> {
  const invalidate = useTaskInvalidation();
  return useMutation({
    mutationFn: ({ taskIds, routeId }: ReassignManyVars) =>
      api.tasks.reassignMany(taskIds, routeId),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Mutations — recurring plans
// ---------------------------------------------------------------------------

function useRecurringInvalidation() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['technical', 'recurring'] });
    // Assigning a plan generates tasks on the target route.
    void client.invalidateQueries({ queryKey: keys.routes() });
    void client.invalidateQueries({ queryKey: keys.tasks() });
  };
}

export interface AssignRecurringVars {
  planId: number;
  routeId: number;
}

export function useAssignRecurringRoute(): UseMutationResult<
  RecurringIgienizare,
  unknown,
  AssignRecurringVars
> {
  const invalidate = useRecurringInvalidation();
  return useMutation({
    mutationFn: ({ planId, routeId }: AssignRecurringVars) =>
      api.recurring.assignRoute(planId, routeId),
    onSuccess: invalidate,
  });
}

export function useDeactivateRecurring(): UseMutationResult<
  RecurringIgienizare,
  unknown,
  number
> {
  const invalidate = useRecurringInvalidation();
  return useMutation({
    mutationFn: (planId: number) => api.recurring.deactivate(planId),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Mutations — employees (admin endpoints, need the admin role on the caller's token)
// ---------------------------------------------------------------------------

function useEmployeeInvalidation() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: keys.drivers() });
    void client.invalidateQueries({ queryKey: keys.routes() });
  };
}

export function useCreateEmployee(): UseMutationResult<Employee, unknown, CreateEmployeeInput> {
  const invalidate = useEmployeeInvalidation();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => api.employees.create(input),
    onSuccess: invalidate,
  });
}

export interface UpdateEmployeeVars {
  id: number;
  input: Partial<CreateEmployeeInput>;
}

export function useUpdateEmployee(): UseMutationResult<Employee, unknown, UpdateEmployeeVars> {
  const invalidate = useEmployeeInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: UpdateEmployeeVars) => api.employees.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteEmployee(): UseMutationResult<void, unknown, number> {
  const invalidate = useEmployeeInvalidation();
  return useMutation({
    mutationFn: (id: number) => api.employees.remove(id),
    onSuccess: invalidate,
  });
}
