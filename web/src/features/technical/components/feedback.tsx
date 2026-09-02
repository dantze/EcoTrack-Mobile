/**
 * Toasts and confirmations for the Technical screens.
 *
 * The UI kit freezes the *shapes* (`ToastApi`, `ConfirmOptions`) but does not
 * ship a host or a hook, so the module provides its own thin implementation
 * against those exact types. If the kit later exports a provider, screens can
 * switch by changing this file alone.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Modal } from '@/components/ui';
import type { ConfirmOptions, Toast, ToastApi, ToastKind } from '@/components/ui';

interface Feedback {
  toast: ToastApi;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<Feedback | null>(null);

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

const TOAST_TONES: Record<ToastKind, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-border bg-surface text-ink',
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<Feedback>(
    () => ({
      toast: {
        success: (message: string) => push('success', message),
        error: (message: string) => push('error', message),
        info: (message: string) => push('info', message),
      },
      confirm: (options: ConfirmOptions) =>
        new Promise<boolean>((resolve) => setPending({ options, resolve })),
    }),
    [push],
  );

  const settle = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-lg ${TOAST_TONES[item.kind]}`}
          >
            <span className="min-w-0 flex-1">{item.message}</span>
            <button
              onClick={() => dismiss(item.id)}
              aria-label="Închide notificarea"
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.options.title ?? ''}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)}>
              {pending?.options.cancelLabel ?? 'Anulează'}
            </Button>
            <Button
              variant={pending?.options.destructive ? 'danger' : 'primary'}
              onClick={() => settle(true)}
            >
              {pending?.options.confirmLabel ?? 'Confirmă'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-ink-muted">{pending?.options.body}</div>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): Feedback {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return value;
}
