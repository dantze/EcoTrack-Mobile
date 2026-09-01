/**
 * Domain errors both API implementations raise.
 *
 * `ApiError` (src/api/http.ts) and `MockApiError` (src/mocks/store.ts) each
 * belong to exactly one implementation, so a screen cannot branch on either
 * without pinning itself to a data mode. Anything the UI has to RECOGNISE —
 * as opposed to merely display — lives here instead, and live and mock both
 * throw the same class.
 */

/**
 * One order standing in the way of retiring a subscription.
 * Mirrors backend dto/BlockingOrderRef.java.
 */
export interface BlockingOrder {
  id: number;
  number: number;
  orderType: string;
  clientName: string | null;
  date: string | null;
}

/**
 * `DELETE /api/subscriptions/{id}` was refused with 409 because unfulfilled
 * orders still reference the plan. `message` is the backend's own Romanian
 * sentence; `blockingOrders` is what lets the UI name them instead of showing
 * a bare count. See SubscriptionService.deactivate().
 */
export class SubscriptionInUseError extends Error {
  readonly blockingOrders: readonly BlockingOrder[];

  constructor(message: string, blockingOrders: readonly BlockingOrder[]) {
    super(message);
    this.name = 'SubscriptionInUseError';
    this.blockingOrders = blockingOrders;
  }
}
