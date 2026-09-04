/**
 * "You have unsaved changes" for the form drawers (TODO-58).
 *
 * `OrderFormDrawer` is a ~950-line form and `ClientFormDrawer` a shorter one;
 * both close on Escape, on a backdrop click and on Renunță, and all three used
 * to throw the operator's work away without asking. That is a slip away at any
 * moment, and the form seeds its state once from props — so a reopened drawer
 * does not bring anything back.
 *
 * Two things this deliberately does NOT do:
 *
 * - **It does not ask when nothing changed.** A confirm on every close trains
 *   people to dismiss it, and then it is not a guard any more. `dirty` is
 *   computed by the caller against the state it opened with, so opening a
 *   drawer and pressing Escape is silent.
 * - **It does not block the browser.** No `beforeunload`: a tab close is a
 *   different intent from a drawer close, and the browser's own dialog cannot
 *   be worded, translated, or told which form it is about.
 *
 * The returned function is async but never rejects — callers pass it straight
 * to `onClose`.
 */

import { useCallback } from 'react';
import { requestConfirm } from './feedback';

export interface UnsavedChangesGuard {
  /** True when the form differs from the state it was opened with. */
  dirty: boolean;
  /** What to run once the operator has agreed to discard, or had nothing to discard. */
  onClose: () => void;
  /** Overrides for a caller whose noun is not "modificările". */
  title?: string;
  body?: string;
}

export function useUnsavedChangesGuard({
  dirty,
  onClose,
  title = 'Închizi fără să salvezi?',
  body = 'Modificările făcute în acest formular se pierd.',
}: UnsavedChangesGuard): () => void {
  return useCallback(() => {
    if (!dirty) {
      onClose();
      return;
    }

    void requestConfirm({
      title,
      body,
      confirmLabel: 'Renunță la modificări',
      cancelLabel: 'Continuă editarea',
      destructive: true,
    }).then((confirmed) => {
      if (confirmed) onClose();
    });
  }, [dirty, onClose, title, body]);
}

/**
 * Snapshot helper for `dirty`.
 *
 * The form states here are flat bags of strings, booleans and ids, so a
 * structural compare is both correct and cheap — and cheaper than the render
 * it guards. It is a plain function rather than a hook so the caller decides
 * what belongs in the snapshot: `OrderFormDrawer` folds in the selected client
 * id, which lives outside the form state but is very much part of the work.
 */
export function snapshot(value: unknown): string {
  return JSON.stringify(value);
}
