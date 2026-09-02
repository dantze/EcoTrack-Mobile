/**
 * Status pill, on the shadcn Badge.
 *
 * Two readings of the same five tones. The default is a tinted fill with a
 * hairline of the same hue — strong enough to scan down a column of 200 rows,
 * quiet enough that ten of them do not fight. `dot` drops the fill entirely
 * and leaves a 6px dot beside the label, which is what a dense Outlook-style
 * status column wants: the pill's box is chrome the row cannot spare.
 */

import { Badge as ShadcnBadge } from '@/components/shadcn/badge';
import { cn } from '@/lib/utils';
import type { BadgeProps } from './types';

const TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-surface-hover text-ink-muted ring-border',
  info: 'bg-info-50 text-info-700 ring-info-200',
  success: 'bg-success-50 text-success-700 ring-success-200',
  warning: 'bg-warning-50 text-warning-700 ring-warning-200',
  danger: 'bg-danger-50 text-danger-700 ring-danger-200',
};

const DOTS: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-ink-subtle',
  info: 'bg-info-600',
  success: 'bg-success-600',
  warning: 'bg-warning-600',
  danger: 'bg-danger-600',
};

export interface BadgeExtraProps {
  /**
   * Quiet form: a status dot plus plain label, no fill and no ring. Use it in
   * table columns; keep the filled pill for badges that stand alone.
   */
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: BadgeProps & BadgeExtraProps) {
  return (
    <ShadcnBadge
      variant="secondary"
      className={cn(
        'max-w-full gap-1.5 px-2',
        dot ? 'bg-transparent px-0 text-ink' : cn('ring-1 ring-inset', TONES[tone]),
        className,
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOTS[tone])} />}
      <span className="truncate">{children}</span>
    </ShadcnBadge>
  );
}
