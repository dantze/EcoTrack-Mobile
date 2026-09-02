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

export { toast } from '@/components/ui';

/** Turns an unknown thrown value into a Romanian message for the toast. */
export function errorMessage(error: unknown, fallback: string): string {
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
