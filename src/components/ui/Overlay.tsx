/**
 * Modal and Drawer.
 *
 * Both share one shell: portal to `document.body`, scrim, focus trap, ESC to
 * close, scroll lock, and focus returned to whatever opened them. The split is
 * purely spatial — Modal centres for a decision, Drawer slides in from the
 * right for record detail so the table stays visible and in place behind it.
 *
 * Mark the field that should receive focus on open with `data-autofocus`.
 */

import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import { CloseIcon } from './icons';
import { cx, useEscapeKey, useFocusTrap, useScrollLock } from './utils';
import type { DrawerProps, ModalProps } from './types';

const MODAL_WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const;

const DRAWER_WIDTHS = {
  md: 'w-[30rem]',
  lg: 'w-[38rem]',
  xl: 'w-[48rem]',
} as const;

/** Stacking floors, so a confirm can sit above a modal that opened it. */
const LAYERS = { base: 'z-50', top: 'z-[70]' } as const;

export interface OverlayExtraProps {
  /** `top` stacks above another overlay — used by the confirm dialog. */
  layer?: keyof typeof LAYERS;
  /** Clicking the scrim closes by default; disable for destructive forms. */
  dismissOnBackdrop?: boolean;
  /** Extra content in the header bar, left of the close button. */
  headerAside?: ReactNode;
  className?: string;
}

function useOverlay(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEscapeKey(open, onClose);
  useScrollLock(open);
  useFocusTrap(panelRef, open);
  return panelRef;
}

function OverlayHeader({
  titleId,
  title,
  aside,
  onClose,
}: {
  titleId: string;
  title: ReactNode;
  aside?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
      <h2 id={titleId} className="min-w-0 truncate text-sm font-semibold text-ink">
        {title}
      </h2>
      <div className="flex shrink-0 items-center gap-1.5">
        {aside}
        <IconButton label="Închide" variant="ghost" size="sm" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'md',
  layer = 'base',
  dismissOnBackdrop = true,
  headerAside,
  className,
}: ModalProps & OverlayExtraProps) {
  const panelRef = useOverlay(open, onClose);
  const titleId = useId();

  if (!open) return null;

  return createPortal(
    <div className={cx('fixed inset-0 overflow-y-auto', LAYERS[layer])}>
      <div
        className="fixed inset-0 animate-fade-in bg-brand-900/35 backdrop-blur-[1px]"
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      {/* `my-auto` centres short dialogs but still lets tall ones scroll. */}
      <div className="relative flex min-h-full items-start justify-center p-6 sm:p-10">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cx(
            'my-auto flex w-full animate-scale-in flex-col overflow-hidden rounded-xl',
            'bg-white shadow-modal ring-1 ring-black/5 focus:outline-none',
            MODAL_WIDTHS[width],
            className,
          )}
        >
          <OverlayHeader titleId={titleId} title={title} aside={headerAside} onClose={onClose} />
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-sunken px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'lg',
  layer = 'base',
  dismissOnBackdrop = true,
  headerAside,
  className,
}: DrawerProps & OverlayExtraProps) {
  const panelRef = useOverlay(open, onClose);
  const titleId = useId();

  if (!open) return null;

  return createPortal(
    <div className={cx('fixed inset-0 flex justify-end', LAYERS[layer])}>
      <div
        className="absolute inset-0 animate-fade-in bg-brand-900/25"
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative flex h-full max-w-[calc(100vw-3rem)] animate-slide-left flex-col',
          'border-l border-border bg-white shadow-panel focus:outline-none',
          DRAWER_WIDTHS[width],
          className,
        )}
      >
        <OverlayHeader titleId={titleId} title={title} aside={headerAside} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-sunken px-5 py-3">
            {footer}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

/**
 * Label/value rows for drawer bodies. Both feature modules show record detail
 * this way, so the alignment is decided here rather than twice.
 */
export function DetailList({
  items,
  columns = 1,
  className,
}: {
  items: { label: ReactNode; value: ReactNode }[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl
      className={cx(
        'grid gap-x-6 gap-y-2.5',
        columns === 2 ? 'grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="flex min-w-0 flex-col gap-0.5 border-b border-border/70 pb-2 last:border-0">
          <dt className="text-xs text-ink-subtle">{item.label}</dt>
          <dd className="min-w-0 text-sm break-words text-ink">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
