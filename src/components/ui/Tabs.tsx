/**
 * Underlined tabs with the full ARIA tab pattern, including arrow-key roving
 * focus. Counts sit in a pill so "Sarcini 128" scans as one label.
 */

import { useRef } from 'react';
import { cx, FOCUS_RING_TIGHT } from './utils';
import type { TabsProps } from './types';

export interface TabsExtraProps {
  className?: string;
  /** Aligns the strip with the page gutter; turn off inside cards. */
  inset?: boolean;
}

export function Tabs({ items, active, onChange, className, inset = true }: TabsProps & TabsExtraProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const jump = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
    if (!delta && jump === null) return;

    event.preventDefault();
    const current = items.findIndex((item) => item.id === active);
    const nextIndex =
      jump !== null ? jump : (current + delta + items.length) % items.length;
    const next = items[nextIndex];
    if (!next) return;
    onChange(next.id);
    stripRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`)
      ?.focus();
  };

  return (
    <div
      ref={stripRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cx(
        'flex items-center gap-1 overflow-x-auto border-b border-border bg-white',
        inset && 'px-5',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab-id={item.id}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cx(
              '-mb-px flex shrink-0 items-center gap-1.5 rounded-t-sm border-b-2 px-2.5 py-2',
              'text-sm font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-ink-muted hover:border-border-strong hover:text-ink',
              FOCUS_RING_TIGHT,
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cx(
                  'tabular rounded-full px-1.5 py-px text-[0.6875rem] font-semibold',
                  isActive ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-ink-muted',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
