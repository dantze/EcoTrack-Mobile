/**
 * Sales toasts — now the app's toasts.
 *
 * This module used to carry a second, private toast store with its own store,
 * its own timings and its own colours, for one stated reason: "the app has no
 * provider mounted at the root (main.tsx is not ours to edit)". Both halves of
 * that are gone — `src/theme/AppProviders.tsx` mounts the host for every
 * screen — so the duplicate is retired and the names re-point at the kit's.
 *
 * The file stays because ~20 Sales call sites import `toast` and
 * `errorMessage` from it, and because `errorMessage` is genuinely local: it is
 * the Sales module's phrasing rule for an unknown thrown value.
 */

import { ApiError, serverMessage } from '@/api';

export { toast } from '@/components/ui';

/**
 * Turns an unknown thrown value into a Romanian message for the toast.
 *
 * **The server's own words win** (TODO-51). `ApiError.message` is the request
 * line — "DELETE /subscriptions/3 failed with 409" — so the old rule pasted an
 * English technical string after a Romanian fallback, for exactly the refusals
 * that were written to be read: the insufficient-quantity 409, the retired-plan
 * 409, and `SubscriptionService.blockedMessage`, which goes to the trouble of
 * agreeing in Romanian ("1 comandă" vs "24 de comenzi"). That last one was
 * visible only because `SubscriptionsPage` special-cases 409 on that one
 * screen; `serverMessage` is where the rule belongs instead.
 *
 * The server message is shown ALONE, without `fallback` in front of it: these
 * sentences already name what failed, and "Nu s-a putut șterge abonamentul:
 * Abonamentul „X” nu poate fi șters, 3 comenzi îl folosesc." says it twice.
 *
 * A `MockApiError` is a plain `Error` whose message IS the user-facing text, so
 * mock mode keeps falling through to the last branch and reads as it always did.
 */
export function errorMessage(error: unknown, fallback: string): string {
  const fromServer = serverMessage(error);
  if (fromServer) return fromServer;
  if (error instanceof ApiError) return `${fallback} (cod ${error.status}).`;
  if (error instanceof Error && error.message) return `${fallback}: ${error.message}`;
  return fallback;
}

/**
 * A no-op: the toast viewport is mounted once by the app, not once per screen.
 * Kept so the Sales pages that render `<Toaster />` keep compiling while they
 * are migrated; it renders nothing and costs nothing.
 */
export function Toaster() {
  return null;
}
