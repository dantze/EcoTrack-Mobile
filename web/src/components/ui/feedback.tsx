/**
 * Toasts and confirmations.
 *
 * Both are reachable from OUTSIDE React — `toast.error()` is usually called
 * from a mutation callback nowhere near a provider, and `useConfirm()` has to
 * hand back a promise that resolves after the user answers. So the API is
 * module-level and the surfaces are mounted once, by the app.
 *
 * Toasts are Sonner's (`<Toaster/>` lives in src/theme/AppProviders.tsx). What
 * stays here is the app's own vocabulary — three kinds, Romanian labels, and
 * the de-duplication rule — because Sonner has no opinion about any of that
 * and ~200 call sites already speak this dialect.
 *
 * Confirmations are a shadcn `AlertDialog` plus a small queue: two confirms
 * asked at once must not overwrite each other, and each promise must resolve
 * with the answer to ITS question.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { toast as sonner } from 'sonner';
import { TriangleAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/alert-dialog';
import { cn } from './utils';
import type { ConfirmOptions, ToastApi, ToastKind } from './types';

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

/** An error is read, a success is glanced at. */
const TTL: Record<ToastKind, number> = { success: 4000, info: 5000, error: 8000 };

/**
 * A failing mutation that retries would otherwise stack five identical cards.
 * Sonner treats a repeated `id` as an update of the toast that is already on
 * screen, so deriving the id from the message is the whole de-duplication rule.
 */
const toastId = (kind: ToastKind, message: string) => `${kind}:${message}`;

function push(kind: ToastKind, message: string) {
  const id = toastId(kind, message);
  const options = { id, duration: TTL[kind] };
  if (kind === 'success') sonner.success(message, options);
  else if (kind === 'error') sonner.error(message, options);
  else sonner.info(message, options);
  return id;
}

/** Usable outside React (api layers, route loaders) as well as through `useToast`. */
export const toast: ToastApi = {
  success: (message) => void push('success', message),
  error: (message) => void push('error', message),
  info: (message) => void push('info', message),
};

/** Dismiss by the id `toast.*` used, or with no argument to clear the stack. */
export function dismissToast(id?: string) {
  sonner.dismiss(id);
}

export function useToast(): ToastApi {
  return toast;
}

// ---------------------------------------------------------------------------
// Confirmations
// ---------------------------------------------------------------------------

interface ConfirmRequest {
  id: number;
  options: ConfirmOptions;
  resolve: (answer: boolean) => void;
}

let sequence = 0;
let confirmQueue: ConfirmRequest[] = [];
const confirmListeners = new Set<() => void>();

const subscribeConfirms = (listener: () => void) => {
  confirmListeners.add(listener);
  return () => confirmListeners.delete(listener);
};

const getConfirmSnapshot = () => confirmQueue;

export function requestConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    sequence += 1;
    confirmQueue = [...confirmQueue, { id: sequence, options, resolve }];
    confirmListeners.forEach((listener) => listener());
  });
}

function answerConfirm(id: number, answer: boolean) {
  const request = confirmQueue.find((entry) => entry.id === id);
  confirmQueue = confirmQueue.filter((entry) => entry.id !== id);
  confirmListeners.forEach((listener) => listener());
  request?.resolve(answer);
}

export function useConfirm() {
  return useMemo(() => (options: ConfirmOptions) => requestConfirm(options), []);
}

/**
 * Answers every outstanding question `false` and empties the queue.
 *
 * The queue is module-level, which is what lets `requestConfirm` be called from
 * outside React — and also means a question nobody answered outlives whatever
 * asked it. In the app that is nearly unreachable (`ConfirmHost` is mounted for
 * the session), but it is not nothing: a pending promise never settles, so the
 * `await` in the caller is parked forever.
 *
 * In tests it is very reachable — a test that opens a confirm and asserts on it
 * without answering leaves it queued, and the NEXT test renders with a modal
 * already on screen. `src/test/setup.ts` calls this after every test for the
 * same reason it calls `cleanup()`: state that outlives a test is not isolation.
 *
 * `false` rather than dropping the promises: a caller waiting on an answer
 * should hear "no", which is the safe answer for every question this asks.
 */
export function resetConfirms() {
  const pending = confirmQueue;
  confirmQueue = [];
  confirmListeners.forEach((listener) => listener());
  pending.forEach((request) => request.resolve(false));
}

/**
 * Keeps this dialog out of the underlying overlay's `aria-hidden` sweep.
 *
 * THE BUG. A modal Radix overlay calls `hideOthers` on open, which marks every
 * other child of `<body>` `aria-hidden="true"` so assistive tech sees only the
 * dialog. `ConfirmHost` portals into its own child of `<body>`, and when a
 * confirm is opened FROM inside a drawer or modal — "discard unsaved changes?"
 * from a form drawer, "revoke this session?" from `EmployeeSessionsModal` —
 * that child is created after the sweep and gets marked too. The result is a
 * question the user is being asked that a screen reader cannot see, on top of a
 * dialog it can. Visually it is fine, which is why it survived.
 *
 * THE REPAIR. Clear the marking on our own portal container, and keep it clear:
 * `hideOthers` installs a MutationObserver, so a one-shot removal can be undone
 * by the next DOM change. This observes the same attribute and re-clears it,
 * which is deterministic regardless of what the library does.
 *
 * Scoped to OUR container only — everything else the overlay hid stays hidden,
 * which is the behaviour that makes a modal a modal. The attribute is restored
 * on unmount so the overlay underneath is left exactly as it was found.
 */
function useStayVisibleToAssistiveTech() {
  const contentRef = useRef<HTMLDivElement>(null);

  const attach = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
  }, []);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    // Radix's portal container is the ancestor that sits directly under body.
    let container: HTMLElement | null = node;
    while (container && container.parentElement !== document.body) {
      container = container.parentElement;
    }
    if (!container) return;

    const target = container;
    const previous = target.getAttribute('aria-hidden');

    const unhide = () => {
      if (target.getAttribute('aria-hidden') !== null) target.removeAttribute('aria-hidden');
      // The marker `hideOthers` uses to remember what it hid. Left behind, a
      // later cleanup pass would treat this node as one of its own.
      if (target.getAttribute('data-aria-hidden') !== null) {
        target.removeAttribute('data-aria-hidden');
      }
    };

    unhide();
    const observer = new MutationObserver(unhide);
    observer.observe(target, { attributes: true, attributeFilter: ['aria-hidden', 'data-aria-hidden'] });

    return () => {
      observer.disconnect();
      if (previous !== null) target.setAttribute('aria-hidden', previous);
    };
  }, []);

  return attach;
}

/**
 * The confirm dialog itself.
 *
 * Keyed by request id so consecutive confirmations REMOUNT rather than
 * re-render: a dialog that is reused across two questions keeps the previous
 * one's focus and animation state, and for a beat shows the old title under
 * the new one's buttons.
 */
export function ConfirmHost() {
  const queue = useSyncExternalStore(subscribeConfirms, getConfirmSnapshot, getConfirmSnapshot);
  const current = queue[0];

  if (!current) return null;
  // Keyed AND separate: the key remounts between questions, and the split is
  // what lets `useStayVisibleToAssistiveTech` run its effect when the dialog
  // appears rather than when the (usually empty) host mounts.
  return <ConfirmDialog key={current.id} request={current} />;
}

function ConfirmDialog({ request: current }: { request: ConfirmRequest }) {
  const attachContent = useStayVisibleToAssistiveTech();

  const {
    title,
    body,
    confirmLabel = 'Confirmă',
    cancelLabel = 'Anulează',
    destructive,
  } = current.options;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        // Escape and the overlay both mean "no". A dismissed question must
        // still settle its promise, or the caller waits forever.
        if (!open) answerConfirm(current.id, false);
      }}
    >
      <AlertDialogContent ref={attachContent} className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            {destructive && (
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-danger-100 text-danger-600"
              >
                <TriangleAlert className="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="text-sm">{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-sm leading-relaxed text-ink-muted">
                {body ?? 'Această acțiune nu poate fi anulată.'}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Cancel is the auto-focused control, not the confirm action — Enter
              or a stray Space should never fire a destructive (or any) action
              the user has not deliberately reached for. */}
          <AlertDialogCancel autoFocus onClick={() => answerConfirm(current.id, false)}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => answerConfirm(current.id, true)}
            className={cn(
              destructive &&
                'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30',
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Mounted once, by the app shell. `ToastProvider` and `ToastViewport` survive
 * as names because the shell and a handful of screens import them; the toast
 * half of the job now belongs to Sonner, so only the confirm host is left to
 * render.
 */
export function FeedbackHost() {
  return <ConfirmHost />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FeedbackHost />
    </>
  );
}

/** Kept for import compatibility; Sonner owns the viewport now. */
export function ToastViewport() {
  return null;
}
