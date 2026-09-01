/**
 * SubscriptionController — /api/subscriptions
 *
 * `remove()` is a SOFT delete: the controller calls deactivate(), flipping
 * isActive to false. The plan disappears from list() but is still returned by
 * listAll(). Nothing is ever removed from the database.
 *
 * It is also REFUSED with 409 while unfulfilled orders still reference the
 * plan — that refusal arrives here as SubscriptionInUseError, carrying the
 * blocking orders so the screen can list them.
 */

import type { SubscriptionsApi } from '../contract';
import type { Subscription } from '@/types/domain';
import { ApiError, request } from '../http';
import { SubscriptionInUseError, type BlockingOrder } from '../errors';
import { normalizeSubscription, type RawSubscription } from './normalize';

/** The 409 body GlobalExceptionHandler emits for ResourceInUseException. */
interface InUseBody {
  message?: string;
  blockingOrders?: BlockingOrder[];
}

/**
 * A 409 from DELETE means unfulfilled orders still reference the plan. Rethrow
 * it as SubscriptionInUseError so the screen can list them; anything else keeps
 * bubbling as the ApiError it already was.
 */
function rethrowInUse(error: unknown): never {
  if (error instanceof ApiError && error.status === 409) {
    let parsed: InUseBody = {};
    try {
      parsed = JSON.parse(error.body) as InUseBody;
    } catch {
      // A 409 with an unparseable body still means "in use" — we just cannot
      // name the blockers.
    }
    throw new SubscriptionInUseError(
      parsed.message ?? 'Abonamentul nu poate fi șters: este folosit de comenzi nefinalizate.',
      parsed.blockingOrders ?? [],
    );
  }
  throw error;
}

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
    try {
      await request<void>(`/subscriptions/${id}`, { method: 'DELETE' });
    } catch (error) {
      rethrowInUse(error);
    }
  },
};
