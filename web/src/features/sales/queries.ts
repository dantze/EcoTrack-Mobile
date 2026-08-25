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
import { api, type ClientInput, type OrderInput } from '@/api';
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
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useClients(): UseQueryResult<Client[]> {
  return useQuery({ queryKey: salesKeys.clients, queryFn: () => api.clients.list() });
}

export function useOrders(): UseQueryResult<Order[]> {
  return useQuery({ queryKey: salesKeys.orders, queryFn: () => api.orders.list() });
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
 * Task status per order, for the status column. There is no batch endpoint —
 * the mobile app fans out one `GET /tasks/order/{id}/exists` per order and so
 * do we, in a single query so it happens once per order-list revision.
 */
export function useOrderTaskStatuses(orderIds: number[]): UseQueryResult<OrderTaskStatusMap> {
  const sorted = [...orderIds].sort((a, b) => a - b);
  const fingerprint = sorted.join(',');
  return useQuery({
    queryKey: salesKeys.orderTaskStatuses(fingerprint),
    enabled: sorted.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const settled = await Promise.allSettled(
        sorted.map(async (id) => ({ id, status: await api.tasks.statusForOrder(id) })),
      );
      const map: OrderTaskStatusMap = {};
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        const { id, status } = result.value;
        map[id] = status.hasTask ? status.status : null;
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

export interface UploadIdPhotoVars {
  clientId: number;
  file: File;
}

export function useUploadIdPhoto(): UseMutationResult<string, Error, UploadIdPhotoVars> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, file }: UploadIdPhotoVars) =>
      api.clients.uploadIdPhoto(clientId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.clients });
    },
  });
}

export function useDeleteIdPhoto(): UseMutationResult<string, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: number) => api.clients.deleteIdPhoto(clientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.clients });
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

export function useDeleteSubscription(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.subscriptions.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.subscriptions });
    },
  });
}
