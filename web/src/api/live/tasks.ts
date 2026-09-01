/**
 * TaskController — /api/tasks
 *
 * The biggest gap between the wire and `@/types/domain` lives here. On the Java
 * entity, `route`, `order`, `photos` and `recurringPlan` are all @JsonIgnore;
 * the JSON exposes only the transient `routeId`, `orderId` and
 * `recurringPlanId`. `Task.route` / `Task.order` / `Task.recurringPlan` are
 * therefore rebuilt client-side by `hydrate()`, which resolves the referenced
 * ids in at most one extra request per relation (a single id fetches that one
 * entity; several fetch the collection once, never N+1).
 *
 * Other traps:
 *  - GET  /tasks/order/{orderId}/exists → object, not a boolean.
 *  - PATCH /tasks/{id}/status          → body {status}.
 *  - PATCH /tasks/{id}/scheduled-date  → body {scheduledDate}; server pins 08:00.
 *  - PUT  /tasks/reassign              → body {taskIds, newRouteId}.
 *  - POST /tasks/{id}/photos           → multipart, field "files" repeated.
 *  - POST /tasks/from-order            → 400 unless BOTH orderId and routeId
 *                                        are present.
 */

import type { CreateTaskInput, OrderTaskStatus, TasksApi } from '../contract';
import type { Employee, Order, RecurringIgienizare, Route, Task, TaskPhoto, TaskStatus } from '@/types/domain';
import { request } from '../http';
import { fetchEmployeeMap } from './employees';
import {
  normalizeOrder,
  normalizePhotoUrls,
  normalizeRecurring,
  normalizeRoute,
  normalizeTask,
  num,
  optNum,
  optStr,
  type RawOrder,
  type RawRecurring,
  type RawRoute,
  type RawTask,
  type Relations,
} from './normalize';

// ---------------------------------------------------------------------------
// Relation hydration
// ---------------------------------------------------------------------------

function distinctIds(tasks: RawTask[], key: 'routeId' | 'orderId' | 'recurringPlanId'): number[] {
  const ids = new Set<number>();
  for (const task of tasks) {
    const id = optNum(task[key]);
    if (id !== null) ids.add(id);
  }
  return [...ids];
}

/**
 * Resolves ids to entities with one request: the single-entity endpoint when
 * exactly one id is wanted, the collection endpoint otherwise. Any failure
 * degrades to an empty map — a task without its route attached still renders.
 */
async function resolve<Raw, Domain extends { id: number }>(
  ids: number[],
  one: (id: number) => Promise<Raw>,
  all: () => Promise<Raw[]>,
  build: (raw: Raw) => Domain,
): Promise<Map<number, Domain>> {
  const map = new Map<number, Domain>();
  if (ids.length === 0) return map;

  try {
    const raws = ids.length === 1 ? [await one(ids[0]!)] : await all();
    for (const raw of raws ?? []) {
      const built = build(raw);
      map.set(built.id, built);
    }
  } catch {
    return map;
  }
  return map;
}

async function hydrate(tasks: RawTask[]): Promise<Relations> {
  const routeIds = distinctIds(tasks, 'routeId');
  const orderIds = distinctIds(tasks, 'orderId');
  const planIds = distinctIds(tasks, 'recurringPlanId');

  // The roster is only needed to fill in Route.employee.
  const employeesPromise: Promise<Map<number, Employee>> =
    routeIds.length > 0 ? fetchEmployeeMap() : Promise.resolve(new Map<number, Employee>());

  const [employees, orders, plans] = await Promise.all([
    employeesPromise,
    resolve<RawOrder, Order>(
      orderIds,
      (id) => request<RawOrder>(`/orders/${id}`),
      () => request<RawOrder[]>('/orders'),
      (raw) => normalizeOrder(raw),
    ),
    resolve<RawRecurring, RecurringIgienizare>(
      planIds,
      (id) => request<RawRecurring>(`/recurring-igienizari/${id}`),
      () => request<RawRecurring[]>('/recurring-igienizari'),
      (raw) => normalizeRecurring(raw),
    ),
  ]);

  const routes = await resolve<RawRoute, Route>(
    routeIds,
    (id) => request<RawRoute>(`/routes/${id}`),
    () => request<RawRoute[]>('/routes'),
    (raw) => normalizeRoute(raw, { employees }),
  );

  return { routes, orders, plans, employees };
}

async function normalizeMany(raw: RawTask[] | null | undefined): Promise<Task[]> {
  const tasks = raw ?? [];
  const relations = await hydrate(tasks);
  return tasks.map((task) => normalizeTask(task, relations));
}

async function normalizeOne(raw: RawTask): Promise<Task> {
  const relations = await hydrate([raw]);
  return normalizeTask(raw, relations);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const tasksApi: TasksApi = {
  async list(): Promise<Task[]> {
    return normalizeMany(await request<RawTask[]>('/tasks'));
  },

  async get(id: number): Promise<Task> {
    return normalizeOne(await request<RawTask>(`/tasks/${id}`));
  },

  async listForRoute(routeId: number): Promise<Task[]> {
    return normalizeMany(await request<RawTask[]>(`/tasks/route/${routeId}`));
  },

  async listForRouteOnDate(routeId: number, date: string): Promise<Task[]> {
    return normalizeMany(await request<RawTask[]>(`/tasks/route/${routeId}/date/${date}`));
  },

  async listForEmployee(employeeId: number): Promise<Task[]> {
    return normalizeMany(await request<RawTask[]>(`/tasks/employee/${employeeId}`));
  },

  async listForEmployeeOnDate(employeeId: number, date: string): Promise<Task[]> {
    return normalizeMany(await request<RawTask[]>(`/tasks/employee/${employeeId}/date/${date}`));
  },

  async create(input: CreateTaskInput): Promise<Task> {
    // POST /tasks binds the body straight onto the Task entity, where `route`
    // and `order` are @JsonIgnore and `routeId`/`orderId` are read-only
    // transients — sending either in the body is silently dropped. So: create
    // the task, then place it with the reassign endpoint.
    //
    // `orderId` has no equivalent second step; the only way to attach a task to
    // an order is createFromOrder(). It is dropped here, deliberately.
    const { routeId, orderId: _unsupportedOrderId, ...fields } = input;
    const created = await request<RawTask>('/tasks', { method: 'POST', body: fields });

    if (routeId === null || routeId === undefined) return normalizeOne(created);

    const placed = await request<RawTask>(`/tasks/${num(created.id)}/reassign/${routeId}`, {
      method: 'PUT',
    });
    return normalizeOne(placed);
  },

  async createFromOrder(orderId: number, routeId?: number | null): Promise<Task> {
    if (routeId === null || routeId === undefined) {
      // Fail here rather than eating an opaque 400: the controller requires
      // both ids and returns an empty body when either is missing.
      throw new Error(
        'createFromOrder requires a routeId — POST /tasks/from-order answers 400 without one.',
      );
    }
    const raw = await request<RawTask>('/tasks/from-order', {
      method: 'POST',
      body: { orderId, routeId },
    });
    return normalizeOne(raw);
  },

  async statusForOrder(orderId: number): Promise<OrderTaskStatus> {
    const raw = await request<{
      hasTask?: boolean;
      taskId?: number | null;
      routeId?: number | null;
      scheduledTime?: string | null;
      status?: string | null;
    }>(`/tasks/order/${orderId}/exists`);

    return {
      hasTask: raw?.hasTask === true,
      taskId: optNum(raw?.taskId),
      routeId: optNum(raw?.routeId),
      scheduledTime: optStr(raw?.scheduledTime),
      status: (optStr(raw?.status) as TaskStatus | null) ?? null,
    };
  },

  async statusForOrders(orderIds: number[]): Promise<Record<number, OrderTaskStatus>> {
    if (orderIds.length === 0) return {};

    const raw = await request<
      Record<
        string,
        {
          hasTask?: boolean;
          taskId?: number | null;
          routeId?: number | null;
          scheduledTime?: string | null;
          status?: string | null;
        }
      >
    >(`/tasks/order-status?ids=${orderIds.join(',')}`);

    const map: Record<number, OrderTaskStatus> = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
      // JSON object keys are strings; the caller works in numbers.
      map[Number(key)] = {
        hasTask: value?.hasTask === true,
        taskId: optNum(value?.taskId),
        routeId: optNum(value?.routeId),
        scheduledTime: optStr(value?.scheduledTime),
        status: (optStr(value?.status) as TaskStatus | null) ?? null,
      };
    }
    return map;
  },

  async updateStatus(id: number, status: TaskStatus): Promise<Task> {
    const raw = await request<RawTask>(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: { status },
    });
    return normalizeOne(raw);
  },

  async updateScheduledDate(id: number, date: string): Promise<Task> {
    const raw = await request<RawTask>(`/tasks/${id}/scheduled-date`, {
      method: 'PATCH',
      body: { scheduledDate: date },
    });
    return normalizeOne(raw);
  },

  async remove(id: number): Promise<void> {
    await request<void>(`/tasks/${id}`, { method: 'DELETE' });
  },

  async reassign(taskId: number, newRouteId: number): Promise<Task> {
    const raw = await request<RawTask>(`/tasks/${taskId}/reassign/${newRouteId}`, {
      method: 'PUT',
    });
    return normalizeOne(raw);
  },

  async reassignMany(taskIds: number[], newRouteId: number): Promise<Task[]> {
    const raw = await request<RawTask[]>('/tasks/reassign', {
      method: 'PUT',
      body: { taskIds, newRouteId },
    });
    return normalizeMany(raw);
  },

  async listPhotos(taskId: number): Promise<TaskPhoto[]> {
    // Returns List<String> — bare URLs. Ids are synthesised positionally.
    //
    // Each URL is a PRESIGNED, expiring link to a private object (TODO-46), not
    // a stable address: the same photo comes back with a different query string
    // on the next call. That is why the ids are positional rather than derived
    // from the URL, and why nothing here caches them.
    return normalizePhotoUrls(await request<string[]>(`/tasks/${taskId}/photos`));
  },

  async uploadPhotos(taskId: number, files: File[]): Promise<TaskPhoto[]> {
    const form = new FormData();
    // Repeated field name — one "files" entry per file.
    for (const file of files) form.append('files', file);

    await request<{ uploaded?: number; urls?: string[] }>(`/tasks/${taskId}/photos`, {
      method: 'POST',
      body: form,
    });

    // The POST answers {uploaded, urls} with no ids and no view of the photos
    // that were already there. Re-read so the caller gets the whole, correctly
    // indexed set.
    return normalizePhotoUrls(await request<string[]>(`/tasks/${taskId}/photos`));
  },
};
