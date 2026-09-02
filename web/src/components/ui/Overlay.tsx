/**
 * Modal and Drawer, on the shadcn `Dialog` and `Sheet`.
 *
 * Radix owns everything that used to be hand-written here — portal, scrim,
 * focus trap, focus restore, Escape, scroll lock — and it owns the enter/exit
 * animation, so neither of these needs a keyframe of its own. The kit's job is
 * the shape: a fixed header, a body that is the only thing scrolling, and an
 * action row pinned to the bottom edge.
 *
 * The split is purely spatial. Modal centres for a decision; Drawer slides in
 * from the right for record detail, so the table stays visible behind it.
 *
 * **Both go full-screen below `sm`.** A 480px drawer on a 390px phone is a
 * sliver of content next to a sliver of scrim, and the scrim is the half that
 * takes the taps.
 *
 * Mark the field that should receive focus on open with `data-autofocus`.
 */

import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/shadcn/sheet';
import { cn } from '@/lib/utils';
import type { DrawerProps, ModalProps } from './types';

const MODAL_WIDTHS = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
} as const;

/**
 * Written with the primitive's own `data-[side=right]:` prefix, not a bare
 * `sm:`. `SheetContent` caps the right-hand sheet at `data-[side=right]:
 * sm:max-w-sm`, and an attribute selector outranks a plain class — a bare
 * `sm:max-w-[38rem]` loses on specificity and the drawer silently stays 24rem.
 */
const DRAWER_WIDTHS = {
  md: 'data-[side=right]:sm:max-w-[30rem]',
  lg: 'data-[side=right]:sm:max-w-[38rem]',
  xl: 'data-[side=right]:sm:max-w-[48rem]',
} as const;

export interface OverlayExtraProps {
  /**
   * Kept for the call sites that still pass it. Radix stacks portals in mount
   * order and every overlay shares one z-index, so a confirm opened from a
   * modal already lands on top — there is nothing left for this to do.
   */
  layer?: 'base' | 'top';
  /** Clicking the scrim closes by default; disable for destructive forms. */
  dismissOnBackdrop?: boolean;
  /** Extra content in the header bar, left of the close button. */
  headerAside?: ReactNode;
  className?: string;
}

/**
 * Radix focuses the first tabbable node on open. `data-autofocus` overrides
 * that — the field a form actually starts in is rarely the first control, and
 * a confirm dialog deliberately starts on Cancel.
 */
function autoFocus(event: Event) {
  const panel = event.currentTarget as HTMLElement | null;
  const target = panel?.querySelector<HTMLElement>('[data-autofocus]');
  if (!target) return;
  event.preventDefault();
  target.focus({ preventScroll: true });
}

/** Shared header/body/footer skeleton, so the two overlays cannot drift apart. */
function OverlayShell({
  title,
  titleSlot: TitleSlot,
  headerSlot: HeaderSlot,
  headerAside,
  children,
  footer,
}: {
  title: ReactNode;
  titleSlot: typeof DialogTitle | typeof SheetTitle;
  headerSlot: typeof DialogHeader | typeof SheetHeader;
  headerAside?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <HeaderSlot className="shrink-0 flex-row items-center gap-3 space-y-0 border-b border-border px-4 py-2.5 pr-12">
        <TitleSlot className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {title}
        </TitleSlot>
        {headerAside && <div className="flex shrink-0 items-center gap-1.5">{headerAside}</div>}
      </HeaderSlot>
      {/* The only scroll container: header and footer stay put, so the action
          row is reachable without scrolling to the end of a long form. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">{children}</div>
      {footer && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-header px-4 py-2.5">
          {footer}
        </div>
      )}
    </>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'md',
  dismissOnBackdrop = true,
  headerAside,
  className,
}: ModalProps & OverlayExtraProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        // Radix warns about a missing description; these dialogs are labelled
        // by their title and describe themselves in the body.
        aria-describedby={undefined}
        onOpenAutoFocus={autoFocus}
        onInteractOutside={(event) => {
          if (!dismissOnBackdrop) event.preventDefault();
        }}
        className={cn(
          'flex max-h-full flex-col gap-0 overflow-hidden bg-surface p-0 text-ink',
          // Phone: the dialog IS the screen. Tablet up: a centred card.
          'inset-0 top-0 left-0 h-full max-h-full w-full max-w-full translate-x-0 translate-y-0 rounded-none',
          'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[85vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl',
          MODAL_WIDTHS[width],
          className,
        )}
      >
        <OverlayShell
          title={title}
          titleSlot={DialogTitle}
          headerSlot={DialogHeader}
          headerAside={headerAside}
          footer={footer}
        >
          {children}
        </OverlayShell>
      </DialogContent>
    </Dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'lg',
  dismissOnBackdrop = true,
  headerAside,
  className,
}: DrawerProps & OverlayExtraProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        onOpenAutoFocus={autoFocus}
        onInteractOutside={(event) => {
          if (!dismissOnBackdrop) event.preventDefault();
        }}
        className={cn(
          'flex h-full flex-col gap-0 border-l border-border bg-surface p-0 text-ink shadow-panel',
          // Full width on a phone, then the widths the contract promises.
          'w-full max-w-full',
          DRAWER_WIDTHS[width],
          className,
        )}
      >
        <OverlayShell
          title={title}
          titleSlot={SheetTitle}
          headerSlot={SheetHeader}
          headerAside={headerAside}
          footer={footer}
        >
          {children}
        </OverlayShell>
      </SheetContent>
    </Sheet>
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
      className={cn(
        'grid gap-x-6 gap-y-2.5',
        // One column on a phone whatever the caller asked for: two 150px
        // columns of label/value wrap into unreadable ribbons.
        columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="flex min-w-0 flex-col gap-0.5 border-b border-border/70 pb-2 last:border-0"
        >
          <dt className="text-xs text-ink-subtle">{item.label}</dt>
          <dd className="min-w-0 text-sm break-words text-ink">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
