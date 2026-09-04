/**
 * Screen header — the Outlook command-bar strip, in its plainest form.
 *
 * **This is a thin wrapper over `CommandBar` and holds no markup of its own
 * (TODO-62).** It used to be a second implementation of the same strip, kept
 * visually identical to `CommandBar` by hand: same fill, same hairline, same
 * heights, maintained in two files. That is a promise nobody can keep — the two
 * had already diverged on the header's translucency and on how the title row
 * spaces itself — and the drift is invisible until two screens sit side by side.
 *
 * So there is one strip now. `CommandBar` renders it; this maps the simpler
 * prop set onto it:
 *
 *   title     -> title
 *   subtitle  -> subtitle
 *   actions   -> tools    (right-aligned, on the title row — where PageHeader
 *                          put them; CommandBar's own `actions` is the ribbon
 *                          strip BELOW the title, which is a different slot)
 *   below     -> tabs     (docked to the bottom edge)
 *
 * WHY IT STILL EXISTS, given that nothing renders it. `PageHeaderProps` is part
 * of `types.ts`, the frozen contract feature screens code against, and removing
 * an entry from that is a bigger decision than deduplicating an implementation.
 * A wrapper settles the thing TODO-62 actually complained about — two strips
 * that will drift — while leaving the contract untouched. Deleting it later is
 * then a one-line removal with no implementation to delete alongside.
 *
 * `eyebrow` is gone. It was a `PageHeaderExtraProps` addition with no caller,
 * and `CommandBar` has no equivalent; adding one to the live component to
 * preserve an unused prop is how the second implementation would grow back.
 */

import type { ReactNode } from 'react';
import { CommandBar } from '@/components/layout/Workbench';
import type { PageHeaderProps } from './types';

export interface PageHeaderExtraProps {
  /** Tabs or a FilterBar docked to the bottom edge of the header. */
  below?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  below,
  className,
}: PageHeaderProps & PageHeaderExtraProps) {
  return (
    <CommandBar
      title={title}
      subtitle={subtitle}
      tools={actions}
      tabs={below}
      className={className}
    />
  );
}
