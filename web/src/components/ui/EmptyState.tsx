/**
 * Empty state. Two flavours via `size`: `md` for a whole screen, `sm` for the
 * inside of a table body where the surrounding chrome already says where we are.
 */

import type { ReactNode } from 'react';
import { cx } from './utils';
import type { EmptyStateProps } from './types';

export interface EmptyStateExtraProps {
  size?: 'sm' | 'md';
  /** Optional glyph above the title; falls back to a neutral placeholder mark. */
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  body,
  action,
  size = 'md',
  icon,
  className,
}: EmptyStateProps & EmptyStateExtraProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-2 px-6 text-center',
        size === 'md' ? 'py-16' : 'py-10',
        className,
      )}
    >
      <span
        aria-hidden
        className={cx(
          'mb-1 flex items-center justify-center rounded-full bg-surface-sunken text-ink-subtle ring-1 ring-border ring-inset',
          size === 'md' ? 'size-11 [&>svg]:size-5' : 'size-9 [&>svg]:size-4',
        )}
      >
        {icon ?? (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}>
            <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
            <path d="M2.5 6.5h11M6 6.5v6" />
          </svg>
        )}
      </span>
      <p className={cx('font-medium text-ink', size === 'md' ? 'text-sm' : 'text-xs')}>{title}</p>
      {body && <div className="max-w-sm text-xs leading-relaxed text-ink-muted">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
