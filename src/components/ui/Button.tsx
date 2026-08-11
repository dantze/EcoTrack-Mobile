/**
 * Button, IconButton, Spinner, Skeleton.
 *
 * One filled brand button per screen area is the intent — `primary` is the
 * navy accent, everything else is neutral chrome so a table toolbar with six
 * actions still reads as quiet.
 */

import type { ReactNode } from 'react';
import type { ButtonProps } from './types';
import { cx, FOCUS_RING } from './utils';

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-brand-700 text-white shadow-xs hover:bg-brand-600 active:bg-brand-800 ' +
    'disabled:bg-brand-700/35 disabled:shadow-none',
  secondary:
    'bg-white text-ink border border-border shadow-xs hover:border-border-strong hover:bg-surface-sunken ' +
    'active:bg-slate-100 disabled:opacity-55 disabled:shadow-none',
  ghost:
    'bg-transparent text-ink-muted hover:bg-slate-100 hover:text-ink active:bg-slate-200/70 ' +
    'disabled:opacity-50',
  danger:
    'bg-danger-600 text-white shadow-xs hover:bg-danger-700 active:bg-danger-700 ' +
    'disabled:bg-danger-600/35 disabled:shadow-none',
};

const SIZES = {
  sm: 'h-7 gap-1.5 px-2.5 text-xs rounded-md',
  md: 'h-8 gap-1.5 px-3 text-sm rounded-md',
};

export interface ButtonExtraProps {
  /** Square, padding-free variant for toolbars — pair with an `aria-label`. */
  iconOnly?: boolean;
  /** Stretches to the container width (drawer footers, empty states). */
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  iconOnly = false,
  block = false,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps & ButtonExtraProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap',
        'transition-colors duration-100 select-none disabled:cursor-not-allowed',
        SIZES[size],
        iconOnly && (size === 'sm' ? 'w-7 px-0' : 'w-8 px-0'),
        block && 'w-full',
        VARIANTS[variant],
        FOCUS_RING,
        className,
      )}
    >
      {loading ? (
        <Spinner className={cx('size-3.5', size === 'sm' && 'size-3')} />
      ) : (
        icon && <span className="-ml-0.5 inline-flex shrink-0 [&>svg]:size-4">{icon}</span>
      )}
      {children}
    </button>
  );
}

/** Toolbar affordance: `iconOnly` Button with the label pushed to a11y only. */
export function IconButton({
  label,
  children,
  ...rest
}: Omit<ButtonProps & ButtonExtraProps, 'iconOnly' | 'children'> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <Button {...rest} iconOnly aria-label={label} title={label}>
      {children}
    </Button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        className ?? 'size-3.5',
      )}
    />
  );
}

/**
 * Grey bar used while data loads. Prefer a layout of these over a lone spinner:
 * a table that keeps its shape while loading does not shift when rows land.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('block animate-pulse rounded bg-slate-200/80', className ?? 'h-3 w-full')}
    />
  );
}
