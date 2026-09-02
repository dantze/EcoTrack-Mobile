/**
 * Outlook's underlined pivot, on the shadcn `line` Tabs.
 *
 * Radix owns the ARIA tab pattern and the arrow-key roving focus that used to
 * be hand-written here. What the kit adds is the pivot look (an underline, not
 * a pill), the count chips, and a strip that scrolls sideways on a phone
 * without showing scrollbar chrome — six filters at 390px is a scroll, not a
 * three-line wrap.
 *
 * No `TabsContent`: every screen here keeps its panel outside the strip and
 * switches on `active` itself.
 */

import { Tabs as ShadcnTabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs';
import { cn } from '@/lib/utils';
import type { TabsProps } from './types';

export interface TabsExtraProps {
  className?: string;
  /** Aligns the strip with the page gutter; turn off inside cards. */
  inset?: boolean;
}

export function Tabs({
  items,
  active,
  onChange,
  className,
  inset = true,
}: TabsProps & TabsExtraProps) {
  return (
    <ShadcnTabs
      value={active}
      onValueChange={onChange}
      className={cn(
        // `no-scrollbar` (from shadcn's sheet): the strip must scroll on a
        // phone, but a scrollbar under a 32px row eats a third of it.
        'no-scrollbar w-full gap-0 overflow-x-auto border-b border-border',
        inset && 'px-3 sm:px-4',
        className,
      )}
    >
      <TabsList variant="line" className="h-8 w-max gap-0 p-0">
        {items.map((item) => (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className={cn(
              'group/tab h-8 gap-1.5 rounded-none px-2.5 text-sm font-medium text-ink-muted',
              'hover:text-ink data-active:text-accent-500',
              // The primitive draws the active underline through `after:`;
              // pull it onto the border and recolour it to the accent so the
              // pivot reads as selection rather than as a hover echo.
              'after:h-0.5 after:bg-accent-500 group-data-horizontal/tabs:after:bottom-0',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded-full bg-surface-hover px-1.5 py-px',
                  'text-[0.6875rem] font-semibold text-ink-muted',
                  'group-data-[state=active]/tab:bg-accent-100',
                  'group-data-[state=active]/tab:text-accent-700',
                )}
              >
                {item.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </ShadcnTabs>
  );
}
