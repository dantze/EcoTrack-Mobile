/**
 * Screen header — the Outlook command-bar strip, in its plainest form.
 *
 * Sticks to the top of the content column and stays shallow: every pixel here
 * is a row of data the operator does not see. The shell also exports a richer
 * `CommandBar` (actions + tools + a tab row); this is the same strip for
 * screens that only need a title and a couple of buttons, and **the two must
 * stay visually identical** — same fill, same hairline, same heights.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
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
      className={cn(
        'sticky top-0 z-20 shrink-0 border-b border-border bg-surface-header',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[0.6875rem] font-semibold tracking-wide text-ink-subtle uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-[0.9375rem] leading-5 font-semibold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <div className="truncate text-xs text-ink-muted [&_strong]:font-medium [&_strong]:text-ink">
              {subtitle}
            </div>
          )}
        </div>
        {/* Wraps onto its own line under ~480px rather than crushing the title. */}
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      {below}
    </header>
  );
}
