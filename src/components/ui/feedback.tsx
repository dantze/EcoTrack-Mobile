/**
 * Toasts and confirmations.
 *
 * Both are driven by module-level stores rather than React context state, for
 * one reason: `useConfirm()` has to hand back a promise that resolves after the
 * user answers, and `toast.error()` is usually called from a mutation callback
 * that is nowhere near a provider. A store plus `useSyncExternalStore` keeps
 * the call sites free of plumbing.
 *
 * Mounting is best-effort: wrap the app in `<ToastProvider>` if you want the
 * host inside your tree, but if nothing has, the first `useToast()` /
 * `useConfirm()` call mounts a host into `document.body` itself. That keeps the
 * feature modules working without editing the app entry point.
 */

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Button } from './Button';
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './icons';
import { Modal } from './Overlay';
import { cx } from './utils';
import type { ConfirmOptions, Toast, ToastApi, ToastKind } from './types';

// ---------------------------------------------------------------------------
// Toast store
// ---------------------------------------------------------------------------

const TTL: Record<ToastKind, number> = { success: 4000, info: 5000, error: 8000 };

let toasts: Toast[] = [];
let sequence = 0;
const toastListeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emitToasts() {
  toastListeners.forEach((listener) => listener());
}

function scheduleDismiss(id: string, ttl: number) {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.set(
    id,
    setTimeout(() => dismissToast(id), ttl),
  );
}

export function dismissToast(id: string) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  toasts = toasts.filter((toast) => toast.id !== id);
  emitToasts();
}

function pushToast(kind: ToastKind, message: string) {
  // A failing mutation that retries would otherwise stack five identical
  // cards; refresh the existing one instead.
  const duplicate = toasts.find((toast) => toast.kind === kind && toast.message === message);
  if (duplicate) {
    scheduleDismiss(duplicate.id, TTL[kind]);
    return;
  }

  sequence += 1;
  const id = `toast-${sequence}`;
  toasts = [...toasts, { id, kind, message }].slice(-4);
  emitToasts();
  scheduleDismiss(id, TTL[kind]);
}

/** Usable outside React (api layers, route loaders) as well as through `useToast`. */
export const toast: ToastApi = {
  success: (message) => pushToast('success', message),
  error: (message) => pushToast('error', message),
  info: (message) => pushToast('info', message),
};

const subscribeToasts = (listener: () => void) => {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
};

// ---------------------------------------------------------------------------
// Confirm store
// ---------------------------------------------------------------------------

interface ConfirmRequest {
  id: number;
  options: ConfirmOptions;
  resolve: (answer: boolean) => void;
}

let confirmQueue: ConfirmRequest[] = [];
const confirmListeners = new Set<() => void>();

function emitConfirms() {
  confirmListeners.forEach((listener) => listener());
}

const subscribeConfirms = (listener: () => void) => {
  confirmListeners.add(listener);
  return () => confirmListeners.delete(listener);
};

const getConfirmSnapshot = () => confirmQueue;

export function requestConfirm(options: ConfirmOptions): Promise<boolean> {
  ensureFallbackHost();
  return new Promise<boolean>((resolve) => {
    sequence += 1;
    confirmQueue = [...confirmQueue, { id: sequence, options, resolve }];
    emitConfirms();
  });
}

function answerConfirm(id: number, answer: boolean) {
  const request = confirmQueue.find((entry) => entry.id === id);
  confirmQueue = confirmQueue.filter((entry) => entry.id !== id);
  emitConfirms();
  request?.resolve(answer);
}

// ---------------------------------------------------------------------------
// Host mounting
// ---------------------------------------------------------------------------

const HostContext = createContext(false);

let fallbackRoot: Root | null = null;
let providerMounted = false;

function ensureFallbackHost() {
  if (providerMounted || fallbackRoot || typeof document === 'undefined') return;
  const node = document.createElement('div');
  node.setAttribute('data-ui-feedback-host', '');
  document.body.appendChild(node);
  fallbackRoot = createRoot(node);
  fallbackRoot.render(<FeedbackHost />);
}

function useFeedbackHost() {
  const inProvider = useContext(HostContext);
  useEffect(() => {
    if (!inProvider) ensureFallbackHost();
  }, [inProvider]);
}

/** Renders both surfaces. Mounted by `ToastProvider` or by the fallback root. */
export function FeedbackHost() {
  return (
    <>
      <ToastViewport />
      <ConfirmHost />
    </>
  );
}

/**
 * Optional. Mount it near the root if you would rather the toast layer live
 * inside the React tree (it then inherits providers such as i18n or theming).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    providerMounted = true;
    return () => {
      providerMounted = false;
    };
  }, []);

  return (
    <HostContext.Provider value={true}>
      {children}
      <FeedbackHost />
    </HostContext.Provider>
  );
}

export function useToast(): ToastApi {
  useFeedbackHost();
  return toast;
}

export function useConfirm() {
  useFeedbackHost();
  return useMemo(() => (options: ConfirmOptions) => requestConfirm(options), []);
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

const TOAST_TONES: Record<ToastKind, { shell: string; icon: string; glyph: ReactNode }> = {
  success: {
    shell: 'border-success-200 bg-success-50',
    icon: 'bg-success-600 text-white',
    glyph: <CheckIcon className="size-3" />,
  },
  error: {
    shell: 'border-danger-200 bg-danger-50',
    icon: 'bg-danger-600 text-white',
    glyph: <AlertIcon className="size-3" />,
  },
  info: {
    shell: 'border-border bg-white',
    icon: 'bg-brand-700 text-white',
    glyph: <InfoIcon className="size-3" />,
  },
};

export function ToastViewport() {
  const items = useSyncExternalStore(subscribeToasts, () => toasts, () => toasts);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-80 flex-col gap-2"
      role="region"
      aria-label="Notificări"
    >
      {items.map((item) => {
        const tone = TOAST_TONES[item.kind];
        return (
          <div
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            aria-live={item.kind === 'error' ? 'assertive' : 'polite'}
            className={cx(
              'pointer-events-auto flex animate-toast-in items-start gap-2.5 rounded-lg border p-3',
              'shadow-toast',
              tone.shell,
            )}
          >
            <span
              aria-hidden
              className={cx(
                'mt-px flex size-4 shrink-0 items-center justify-center rounded-full',
                tone.icon,
              )}
            >
              {tone.glyph}
            </span>
            <p className="min-w-0 flex-1 text-xs leading-relaxed break-words text-ink">
              {item.message}
            </p>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              aria-label="Închide notificarea"
              className="-m-1 shrink-0 rounded p-1 text-ink-subtle transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
            >
              <CloseIcon className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ConfirmHost() {
  const queue = useSyncExternalStore(subscribeConfirms, getConfirmSnapshot, getConfirmSnapshot);
  const current = queue[0];

  if (!current) return null;
  const {
    title,
    body,
    confirmLabel = 'Confirmă',
    cancelLabel = 'Anulează',
    destructive,
  } = current.options;

  return (
    <Modal
      open
      layer="top"
      width="sm"
      title={title}
      onClose={() => answerConfirm(current.id, false)}
      footer={
        <>
          {/* Cancel gets the initial focus, not the confirm action — Enter or a
              stray Space should never fire a destructive (or any) action the
              user hasn't deliberately reached for. */}
          <Button variant="ghost" data-autofocus onClick={() => answerConfirm(current.id, false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => answerConfirm(current.id, true)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {destructive && (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600"
          >
            <AlertIcon className="size-4" />
          </span>
        )}
        <div className="min-w-0 text-sm leading-relaxed text-ink-muted">
          {body ?? 'Această acțiune nu poate fi anulată.'}
        </div>
      </div>
    </Modal>
  );
}
