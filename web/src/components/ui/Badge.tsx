/**
 * Status pill. Tinted fill + a hairline of the same hue: strong enough to scan
 * down a column of 200 rows, quiet enough that ten of them do not fight.
 */

import { cx } from './utils';
import type { BadgeProps } from './types';

const TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-info-50 text-info-700 ring-info-200',
  success: 'bg-success-50 text-success-700 ring-success-200',
  warning: 'bg-warning-50 text-warning-700 ring-warning-200',
  danger: 'bg-danger-50 text-danger-700 ring-danger-200',
};

const DOTS: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-info-600',
  success: 'bg-success-600',
  warning: 'bg-warning-600',
  danger: 'bg-danger-600',
};

export interface BadgeExtraProps {
  /** Leading status dot — useful when a column carries several tones at once. */
  dot?: boolean;
  className?: string;
}

export function Badge({ children, tone = 'neutral', dot = false, className }: BadgeProps & BadgeExtraProps) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs',
        'font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cx('size-1.5 shrink-0 rounded-full', DOTS[tone])} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}
