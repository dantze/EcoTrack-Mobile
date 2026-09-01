/**
 * SubscriptionController — /api/subscriptions
 *
 * `remove()` is a SOFT delete: the controller calls deactivate(), flipping
 * isActive to false. The plan disappears from list() but is still returned by
 * listAll(). Nothing is ever removed from the database.
 *
 * It is REFUSED with a 409 while unfinished orders or active recurring plans
 * still point at the plan; the Romanian message arrives as ApiError.body.
 * `usage()` is the advisory preflight that names those blockers, so the UI can
 * explain the refusal before the operator commits to a delete.
 */

import type { SubscriptionUsage, SubscriptionsApi } from '../contract';
import type { Subscription } from '@/types/domain';
import { request } from '../http';
import { normalizeSubscription, type RawSubscription } from './normalize';

export const subscriptionsApi: SubscriptionsApi = {
  async list(): Promise<Subscription[]> {
    const raw = await request<RawSubscription[]>('/subscriptions');
    return (raw ?? []).map(normalizeSubscription);
  },

  async listAll(): Promise<Subscription[]> {
    const raw = await request<RawSubscription[]>('/subscriptions/all');
    return (raw ?? []).map(normalizeSubscription);
  },

  async get(id: number): Promise<Subscription> {
    return normalizeSubscription(await request<RawSubscription>(`/subscriptions/${id}`));
  },

  async create(input: Omit<Subscription, 'id'>): Promise<Subscription> {
    return normalizeSubscription(
      await request<RawSubscription>('/subscriptions', { method: 'POST', body: input }),
    );
  },

  async update(id: number, input: Omit<Subscription, 'id'>): Promise<Subscription> {
    // update() copies every field unconditionally, so this is a full replace —
    // omitting a field nulls it server-side.
    return normalizeSubscription(
      await request<RawSubscription>(`/subscriptions/${id}`, { method: 'PUT', body: input }),
    );
  },

  async usage(id: number): Promise<SubscriptionUsage> {
    const raw = await request<SubscriptionUsage>(`/subscriptions/${id}/usage`);
    // The DTO is already domain-shaped (ids, numbers, resolved client names),
    // so there is nothing for normalize.ts to absorb here.
    return {
      blocked: raw?.blocked ?? false,
      orders: raw?.orders ?? [],
      recurringPlans: raw?.recurringPlans ?? [],
    };
  },

  async moveOrders(id: number, targetSubscriptionId: number, orderIds: number[]): Promise<number> {
    const raw = await request<{ moved?: number }>(`/subscriptions/${id}/orders/move`, {
      method: 'POST',
      body: { targetSubscriptionId, orderIds },
    });
    return raw?.moved ?? 0;
  },

  async remove(id: number): Promise<void> {
    await request<void>(`/subscriptions/${id}`, { method: 'DELETE' });
  },
};
