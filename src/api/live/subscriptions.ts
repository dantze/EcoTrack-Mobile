/**
 * SubscriptionController — /api/subscriptions
 *
 * `remove()` is a SOFT delete: the controller calls deactivate(), flipping
 * isActive to false. The plan disappears from list() but is still returned by
 * listAll(). Nothing is ever removed from the database.
 */

import type { SubscriptionsApi } from '../contract';
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

  async remove(id: number): Promise<void> {
    await request<void>(`/subscriptions/${id}`, { method: 'DELETE' });
  },
};
