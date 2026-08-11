/**
 * Screen header. Sticks to the top of the content column and stays shallow —
 * every pixel here is a row of data the operator does not see.
 */

import type { ReactNode } from 'react';
import { cx } from './utils';
import type { PageHeaderProps } from './types';

export interface PageHeaderExtraProps {
  /** Small caps line above the title, e.g. the module name. */
  eyebrow?: ReactNode;
  /** Tabs or a FilterBar docked to the bottom edge of the header. */
  below?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  below,
  className,
}: PageHeaderProps & PageHeaderExtraProps) {
  return (
    <header
      className={cx(
        'sticky top-0 z-20 shrink-0 border-b border-border bg-white/95 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-3.5 pb-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-0.5 text-[0.6875rem] font-semibold tracking-wide text-ink-subtle uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-[0.9375rem] leading-5 font-semibold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-ink-muted [&_strong]:font-medium [&_strong]:text-ink">
              {subtitle}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {below}
    </header>
  );
}
