/**
 * TanStack Query bindings for the Sales module.
 *
 * Every server read/write in `features/sales` goes through this file so query
 * keys stay consistent and invalidation is in one place. Keys are hierarchical:
 * invalidating `['orders']` also drops `['orders','client',7]` and the derived
 * task-status query.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api, type ClientInput, type OrderInput, type SubscriptionUsage } from '@/api';
import type {
  Client,
  Order,
  Product,
  RecurringIgienizare,
  Subscription,
  TaskStatus,
} from '@/types/domain';

export const salesKeys = {
  clients: ['clients'] as const,
  clientHasOrders: (id: number) => ['clients', id, 'has-orders'] as const,
  orders: ['orders'] as const,
  clientOrders: (clientId: number) => ['orders', 'client', clientId] as const,
  orderTaskStatuses: (fingerprint: string) =>
    ['orders', 'task-status', fingerprint] as const,
  products: ['products'] as const,
  subscriptions: ['subscriptions'] as const,
  activeSubscriptions: ['subscriptions', 'active'] as const,
  subscriptionUsage: (id: number) => ['subscriptions', id, 'usage'] as const,
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * `enabled` lets a caller outside the Sales screens (the command palette in the
 * shell) hold the same query key without firing a request the signed-in user's
 * roles would not be allowed to make.
 */
export interface ReadOptions {
  enabled?: boolean;
}

export function useClients({ enabled = true }: ReadOptions = {}): UseQueryResult<Client[]> {
  return useQuery({ queryKey: salesKeys.clients, queryFn: () => api.clients.list(), enabled });
}

export function useOrders({ enabled = true }: ReadOptions = {}): UseQueryResult<Order[]> {
  return useQuery({ queryKey: salesKeys.orders, queryFn: () => api.orders.list(), enabled });
}

export function useClientOrders(clientId: number | null): UseQueryResult<Order[]> {
  return useQuery({
    queryKey: salesKeys.clientOrders(clientId ?? -1),
    queryFn: () => api.orders.listForClient(clientId ?? -1),
    enabled: clientId !== null,
  });
}

export function useProducts(): UseQueryResult<Product[]> {
  return useQuery({ queryKey: salesKeys.products, queryFn: () => api.products.list() });
}

/** `includeInactive` picks /subscriptions/all over /subscriptions. */
export function useSubscriptions(includeInactive: boolean): UseQueryResult<Subscription[]> {
  return useQuery({
    queryKey: includeInactive ? salesKeys.subscriptions : salesKeys.activeSubscriptions,
    queryFn: () => (includeInactive ? api.subscriptions.listAll() : api.subscriptions.list()),
  });
}

export type OrderTaskStatusMap = Record<number, TaskStatus | null>;

/**
 * How many order ids go in one `/tasks/order-status` request.
 *
 * The server caps the list at 500 and answers 400 beyond it, because a GET puts
 * the ids in the URL. 200 leaves room to spare at any realistic id width, and a
 * list long enough to need a second chunk is already rare.
 */
const ORDER_STATUS_CHUNK = 200;

/**
 * Task status per order, for the status column.
 *
 * One batched request per chunk (TODO-43), where this used to fan out one
 * `GET /tasks/order/{id}/exists` per order — opening Comenzi with 200 orders was
 * 200 requests. Mock mode hid it behind one shared latency and so did a small
 * dataset. The roll-up is unchanged and still lives server-side in
 * `TaskService.summariseOrderTasks`; only the number of round trips differs.
 *
 * Still `allSettled`, and still per chunk: one failed chunk must leave the other
 * orders with a status rather than blanking the whole column. An order missing
 * from the map renders as unknown, which `isOrderFulfilled` reads as UNFINISHED
 * — the fail-safe direction, since an order only leaves the operator's list on
 * positive evidence.
 */
export function useOrderTaskStatuses(orderIds: number[]): UseQueryResult<OrderTaskStatusMap> {
  const sorted = [...orderIds].sort((a, b) => a - b);
  const fingerprint = sorted.join(',');
  return useQuery({
    queryKey: salesKeys.orderTaskStatuses(fingerprint),
    enabled: sorted.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const chunks: number[][] = [];
      for (let index = 0; index < sorted.length; index += ORDER_STATUS_CHUNK) {
        chunks.push(sorted.slice(index, index + ORDER_STATUS_CHUNK));
      }

      const settled = await Promise.allSettled(
        chunks.map((chunk) => api.tasks.statusForOrders(chunk)),
      );

      const map: OrderTaskStatusMap = {};
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        for (const [id, status] of Object.entries(result.value)) {
          map[Number(id)] = status.hasTask ? status.status : null;
        }
      }
      return map;
    },
  });
}

/**
 * One-shot `GET /clients/{id}/has-orders` for event handlers (the delete
 * guard), cached under the same key a component query would use.
 */
export function useCheckClientHasOrders(): (clientId: number) => Promise<boolean> {
  const queryClient = useQueryClient();
  return (clientId: number) =>
    queryClient.fetchQuery({
      queryKey: salesKeys.clientHasOrders(clientId),
      queryFn: () => api.clients.hasOrders(clientId),
      staleTime: 0,
    });
}

// ---------------------------------------------------------------------------
// Orders — writes
// ---------------------------------------------------------------------------

export interface CreateOrdersVars {
  clientId: number;
  /** More than one for Ridicari: one order per packet group. */
  payloads: OrderInput[];
}

export function useCreateOrders(): UseMutationResult<Order[], Error, CreateOrdersVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, payloads }: CreateOrdersVars) => {
      const created: Order[] = [];
      for (const payload of payloads) {
        created.push(await api.orders.create(clientId, payload));
      }
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.orders });
    },
  });
}

export interface CreateRecurringVars {
  clientId: number;
  input: Partial<RecurringIgienizare>;
}

export function useCreateRecurringPlan(): UseMutationResult<
  RecurringIgienizare,
  Error,
  CreateRecurringVars
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, input }: CreateRecurringVars) =>
      api.recurring.create(clientId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.orders });
      void queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
  });
}

export interface UpdateOrderVars {
  orderId: number;
  payload: OrderInput;
}

export function useUpdateOrder(): UseMutationResult<Order, Error, UpdateOrderVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, payload }: UpdateOrderVars) => api.orders.update(orderId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.orders });
    },
  });
}

/** Bulk-capable delete with an optimistic removal from the cached list. */
export function useDeleteOrders(): UseMutationResult<
  void,
  Error,
  number[],
  { previous: Order[] | undefined }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderIds: number[]) => {
      for (const id of orderIds) await api.orders.remove(id);
    },
    onMutate: async (orderIds) => {
      await queryClient.cancelQueries({ queryKey: salesKeys.orders });
      const previous = queryClient.getQueryData<Order[]>(salesKeys.orders);
      if (previous) {
        queryClient.setQueryData<Order[]>(
          salesKeys.orders,
          previous.filter((order) => !orderIds.includes(order.id)),
        );
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(salesKeys.orders, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.orders });
    },
  });
}

// ---------------------------------------------------------------------------
// Clients — writes
// ---------------------------------------------------------------------------

export function useCreateClient(): UseMutationResult<Client, Error, ClientInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => api.clients.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.clients });
    },
  });
}

export interface UpdateClientVars {
  id: number;
  input: ClientInput;
}

export function useUpdateClient(): UseMutationResult<Client, Error, UpdateClientVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateClientVars) => api.clients.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.clients });
      void queryClient.invalidateQueries({ queryKey: salesKeys.orders });
    },
  });
}

export function useDeleteClient(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.clients.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.clients });
      void queryClient.invalidateQueries({ queryKey: salesKeys.orders });
    },
  });
}

// ---------------------------------------------------------------------------
// Products — writes
// ---------------------------------------------------------------------------

export type ProductInput = Omit<Product, 'id'>;

export function useCreateProduct(): UseMutationResult<Product, Error, ProductInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) => api.products.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.products });
    },
  });
}

export interface UpdateProductVars {
  id: number;
  input: ProductInput;
}

/** Optimistic — inline table editing should feel instant. */
export function useUpdateProduct(): UseMutationResult<
  Product,
  Error,
  UpdateProductVars,
  { previous: Product[] | undefined }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateProductVars) => api.products.update(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: salesKeys.products });
      const previous = queryClient.getQueryData<Product[]>(salesKeys.products);
      if (previous) {
        queryClient.setQueryData<Product[]>(
          salesKeys.products,
          previous.map((product) => (product.id === id ? { ...product, ...input } : product)),
        );
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(salesKeys.products, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.products });
    },
  });
}

export function useDeleteProduct(): UseMutationResult<
  void,
  Error,
  number,
  { previous: Product[] | undefined }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.products.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: salesKeys.products });
      const previous = queryClient.getQueryData<Product[]>(salesKeys.products);
      if (previous) {
        queryClient.setQueryData<Product[]>(
          salesKeys.products,
          previous.filter((product) => product.id !== id),
        );
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(salesKeys.products, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.products });
    },
  });
}

// ---------------------------------------------------------------------------
// Subscriptions — writes
// ---------------------------------------------------------------------------

export type SubscriptionInput = Omit<Subscription, 'id'>;

export function useCreateSubscription(): UseMutationResult<
  Subscription,
  Error,
  SubscriptionInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubscriptionInput) => api.subscriptions.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.subscriptions });
    },
  });
}

export interface UpdateSubscriptionVars {
  id: number;
  input: SubscriptionInput;
}

export function useUpdateSubscription(): UseMutationResult<
  Subscription,
  Error,
  UpdateSubscriptionVars
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateSubscriptionVars) => api.subscriptions.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.subscriptions });
    },
  });
}

/**
 * One-shot `GET /subscriptions/{id}/usage` for the delete guard, in the same
 * shape as `useCheckClientHasOrders`: an event handler asks, rather than every
 * row holding a query it will probably never need.
 *
 * `staleTime: 0` on purpose — a plan can be freed up by finishing its last
 * order in another tab, and a cached "still blocked" would refuse a delete the
 * server would now allow.
 */
export function useCheckSubscriptionUsage(): (id: number) => Promise<SubscriptionUsage> {
  const queryClient = useQueryClient();
  return (id: number) =>
    queryClient.fetchQuery({
      queryKey: salesKeys.subscriptionUsage(id),
      queryFn: () => api.subscriptions.usage(id),
      staleTime: 0,
    });
}

export interface MoveSubscriptionOrdersInput {
  subscriptionId: number;
  targetSubscriptionId: number;
  orderIds: number[];
}

/**
 * Re-points blocking orders onto another plan so a refused delete can be
 * retried (TODO-37).
 *
 * Invalidates `orders` and `tasks` as well as `subscriptions`: the orders now
 * name a different plan, and every non-completed task of theirs had its
 * `productName` rewritten server-side. Leaving those keys alone would show
 * Sarcini the old plan name until something else happened to refetch it.
 */
export function useMoveSubscriptionOrders(): UseMutationResult<
  number,
  Error,
  MoveSubscriptionOrdersInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subscriptionId, targetSubscriptionId, orderIds }: MoveSubscriptionOrdersInput) =>
      api.subscriptions.moveOrders(subscriptionId, targetSubscriptionId, orderIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.subscriptions });
      void queryClient.invalidateQueries({ queryKey: salesKeys.orders });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteSubscription(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.subscriptions.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.subscriptions });
    },
  });
}
