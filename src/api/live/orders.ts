/**
 * OrderController — mapped at /api, so the paths are split:
 *   GET/PUT/DELETE  /orders, /orders/{orderId}
 *   GET/POST        /clients/{clientId}/orders
 *
 * `Order` is Jackson-polymorphic on `orderType` ("Amplasari" | "Ridicari" |
 * "Igienizari") with `visible = true`, so the discriminator must be present on
 * every write body — OrderInput carries it and is passed straight through.
 *
 * Two server behaviours worth knowing about:
 *   - POST with a Ridicare whose pickupQuantity exceeds what is still placed at
 *     that location throws InsufficientQuantityException → HTTP 409 with a
 *     plain-text Romanian message in the body (reachable via ApiError.body).
 *   - PUT only copies non-null fields, so a partial payload is a patch and
 *     clearing a field to null is impossible through this endpoint.
 */

import type { OrderInput, OrdersApi } from '../contract';
import type { Order, RecurringIgienizare } from '@/types/domain';
import { request } from '../http';
import {
  normalizeOrder,
  normalizeRecurring,
  optNum,
  type RawOrder,
  type RawRecurring,
  type Relations,
} from './normalize';

/**
 * `IgienizareOrder.recurringPlan` is @JsonIgnore; only `recurringPlanId`
 * survives. Fetch the plan for a single order (one extra request); for list
 * endpoints we leave `recurringPlan` null rather than firing an N+1 storm.
 */
async function planRelations(raw: RawOrder): Promise<Relations> {
  const planId = optNum(raw.recurringPlanId);
  if (planId === null) return {};

  try {
    const plan = await request<RawRecurring>(`/recurring-igienizari/${planId}`);
    const plans = new Map<number, RecurringIgienizare>();
    plans.set(planId, normalizeRecurring(plan));
    return { plans };
  } catch {
    // A missing or unreadable plan must not take the order down with it.
    return {};
  }
}

export const ordersApi: OrdersApi = {
  async list(): Promise<Order[]> {
    const raw = await request<RawOrder[]>('/orders');
    return (raw ?? []).map((order) => normalizeOrder(order));
  },

  async get(orderId: number): Promise<Order> {
    const raw = await request<RawOrder>(`/orders/${orderId}`);
    return normalizeOrder(raw, await planRelations(raw));
  },

  async listForClient(clientId: number): Promise<Order[]> {
    const raw = await request<RawOrder[]>(`/clients/${clientId}/orders`);
    return (raw ?? []).map((order) => normalizeOrder(order));
  },

  async create(clientId: number, input: OrderInput): Promise<Order> {
    const raw = await request<RawOrder>(`/clients/${clientId}/orders`, {
      method: 'POST',
      body: input,
    });
    return normalizeOrder(raw);
  },

  async update(orderId: number, input: OrderInput): Promise<Order> {
    const raw = await request<RawOrder>(`/orders/${orderId}`, { method: 'PUT', body: input });
    return normalizeOrder(raw);
  },

  async remove(orderId: number): Promise<void> {
    // Cascades server-side: an Igienizare order that owns a recurring plan
    // takes the plan and all of its generated tasks with it.
    await request<void>(`/orders/${orderId}`, { method: 'DELETE' });
  },
};
