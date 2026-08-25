/**
 * Toasts.
 *
 * The UI kit declares `ToastApi` but the app has no provider mounted at the
 * root (main.tsx is not ours to edit), so the Sales module keeps its own tiny
 * store and every Sales page renders a `<Toaster />`. Publishing through a
 * module-level singleton means mutation callbacks deep in a drawer can report
 * without prop drilling.
 */

import { useSyncExternalStore } from 'react';
import type { Toast, ToastApi, ToastKind } from '@/components/ui';

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let nextId = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

function dismiss(id: string): void {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

function push(kind: ToastKind, message: string): void {
  const id = `toast-${(nextId += 1)}`;
  toasts = [...toasts, { id, kind, message }];
  emit();
  window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
}

export const toast: ToastApi = {
  success: (message) => push('success', message),
  error: (message) => push('error', message),
  info: (message) => push('info', message),
};

/** Turns an unknown thrown value into a Romanian message for the toast. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback}: ${error.message}`;
  return fallback;
}

const TONES: Record<ToastKind, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-border bg-white text-ink',
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Toaster() {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-md border px-3 py-2 text-sm shadow-lg ${TONES[item.kind]}`}
        >
          <span className="flex-1">{item.message}</span>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Închide"
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
