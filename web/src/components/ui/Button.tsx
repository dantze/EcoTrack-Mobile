/**
 * Button, IconButton, Spinner, Skeleton — the kit's face on the shadcn
 * primitives.
 *
 * One filled brand button per screen area is the intent — `primary` is the
 * accent, everything else is neutral chrome so a command bar with six actions
 * still reads as quiet. The kit repaints the primitive's variants onto our
 * surface tokens here, in ONE place, rather than at 30 call sites.
 */

import type { ReactNode } from 'react';
import { Button as ShadcnButton } from '@/components/shadcn/button';
import { Spinner as ShadcnSpinner } from '@/components/shadcn/spinner';
import { Skeleton as ShadcnSkeleton } from '@/components/shadcn/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip';
import { cn } from '@/lib/utils';
import type { ButtonProps } from './types';

/**
 * Which shadcn variant each kit variant sits on, plus the token repaint.
 *
 * `secondary` rides `outline` rather than shadcn's `secondary`: an Outlook
 * command bar button is a hairline on the surface, not a grey fill.
 * `danger` is a FILLED red — the primitive's `destructive` is a quiet tint,
 * which is right for a badge and wrong for the one button in a confirm dialog
 * that actually deletes something.
 */
const VARIANTS: Record<
  NonNullable<ButtonProps['variant']>,
  { base: 'default' | 'outline' | 'ghost' | 'destructive'; className: string }
> = {
  primary: {
    base: 'default',
    className: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
  },
  secondary: {
    base: 'outline',
    className:
      'border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-hover ' +
      'hover:text-ink active:bg-surface-active dark:bg-surface dark:hover:bg-surface-hover',
  },
  ghost: {
    base: 'ghost',
    className:
      'text-ink-muted hover:bg-surface-hover hover:text-ink active:bg-surface-active ' +
      'dark:hover:bg-surface-hover',
  },
  danger: {
    base: 'destructive',
    className:
      'bg-destructive text-destructive-foreground hover:bg-destructive/90 ' +
      'active:bg-destructive/80 dark:bg-destructive dark:hover:bg-destructive/90',
  },
};

const SIZES = { sm: 'sm', md: 'default' } as const;
const ICON_SIZES = { sm: 'icon-sm', md: 'icon' } as const;

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
  const { base, className: tone } = VARIANTS[variant];

  return (
    <ShadcnButton
      {...rest}
      type={type}
      variant={base}
      size={iconOnly ? ICON_SIZES[size] : SIZES[size]}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('relative rounded-md', tone, block && 'w-full', className)}
    >
      {/* The label keeps its box while loading, so a row of buttons does not
          reflow the moment one of them starts working. */}
      {loading && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <Spinner className={size === 'sm' ? 'size-3' : 'size-3.5'} />
        </span>
      )}
      <span
        className={cn(
          'inline-flex min-w-0 items-center gap-1.5',
          loading && 'invisible',
        )}
      >
        {icon}
        {children}
      </span>
    </ShadcnButton>
  );
}

export interface IconButtonExtraProps {
  /**
   * Renders a shadcn Tooltip around the button instead of the browser's own
   * `title` bubble. Opt-in, not the default: a Tooltip needs the app's
   * `TooltipProvider` above it, and the kit's overlays mount outside the app
   * tree (the confirm host) where that provider does not exist.
   */
  tooltip?: ReactNode;
}

/**
 * Toolbar affordance: square Button with the label pushed to a11y only. The
 * tooltip is what puts the label back on screen for sighted users — a command
 * bar is a row of glyphs otherwise.
 */
export function IconButton({
  label,
  tooltip,
  children,
  ...rest
}: Omit<ButtonProps & ButtonExtraProps, 'iconOnly' | 'children'> &
  IconButtonExtraProps & {
    label: string;
    children: ReactNode;
  }) {
  if (tooltip === undefined) {
    return (
      <Button {...rest} iconOnly aria-label={label} title={label}>
        {children}
      </Button>
    );
  }

  // No `title` alongside the tooltip: the browser's own bubble would shadow it.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...rest} iconOnly aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <ShadcnSpinner
      aria-hidden
      role={undefined}
      aria-label={undefined}
      className={cn(className ?? 'size-3.5')}
    />
  );
}

/**
 * Grey bar used while data loads. Prefer a layout of these over a lone spinner:
 * a table that keeps its shape while loading does not shift when rows land.
 */
export function Skeleton({ className }: { className?: string }) {
  return <ShadcnSkeleton aria-hidden className={cn('block', className ?? 'h-3 w-full')} />;
}
