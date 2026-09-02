/**
 * The Sales filter strip and the small controls that live in a command bar
 * next to it: search, a labelled filter slot, a segmented view switch, and the
 * inline error notice every Sales screen shows when a fetch fails.
 *
 * Shared by all four Sales screens so the filtering affordances line up. The
 * exported signatures are load-bearing beyond this folder — Comenzi, Clienți,
 * Produse, Abonamente and Calendar all render these — so this file restyles
 * onto the token vocabulary without changing what any of them pass in.
 *
 * `FilterBar` is a strip that wraps rather than scrolls: at 390px the filters
 * stack into rows the thumb can reach instead of hiding behind an edge.
 */

import type { ReactNode, RefObject } from 'react';
import { Search } from 'lucide-react';
import { Button, cx } from '@/components/ui';

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-border bg-surface-header px-3 py-2 sm:px-4">
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  width = 'w-72',
  inputRef,
  controls,
  activeDescendant,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Tailwind width class. Defaults to a toolbar-sized box. */
  width?: string;
  /** Lets a screen focus its search box from a keyboard shortcut ("/"). */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Id of a listbox this box drives — turns it into an ARIA combobox. */
  controls?: string;
  /** Id of the highlighted option in that listbox. */
  activeDescendant?: string;
}) {
  return (
    <div className={cx('relative max-w-full', width)}>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        role={controls ? 'combobox' : undefined}
        aria-expanded={controls ? true : undefined}
        aria-controls={controls}
        aria-autocomplete={controls ? 'list' : undefined}
        aria-activedescendant={activeDescendant}
        className={cx(
          'h-8 w-full rounded-md border border-border bg-surface pr-2.5 pl-8 text-sm text-ink',
          'placeholder:text-ink-subtle',
          'outline-none focus-visible:border-accent-400 focus-visible:ring-2 focus-visible:ring-ring/40',
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
      />
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-subtle"
      />
    </div>
  );
}

/** Small labelled slot so filter controls align on one baseline. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.6875rem] font-semibold tracking-wide text-ink-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  /** Icon shown instead of the label on narrow toolbars. */
  icon?: ReactNode;
}

/**
 * The ribbon's view switch — Luna / Săptămâna / Agendă, Compact / Confortabil.
 *
 * A radiogroup rather than tabs: it picks how the same content is drawn, it
 * does not swap one panel for another, and screen readers should not announce
 * a tablist that has no tabpanel behind it.
 */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
  hideLabelsBelow,
}: {
  value: V;
  options: SegmentedOption<V>[];
  onChange: (value: V) => void;
  /** Accessible name for the group as a whole. */
  label: string;
  /** Below this breakpoint only the icons show. Needs `icon` on every option. */
  hideLabelsBelow?: 'sm' | 'md' | 'lg';
}) {
  const labelClass =
    hideLabelsBelow === 'sm'
      ? 'hidden sm:inline'
      : hideLabelsBelow === 'md'
        ? 'hidden md:inline'
        : hideLabelsBelow === 'lg'
          ? 'hidden lg:inline'
          : undefined;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-surface p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'inline-flex h-6 items-center gap-1.5 rounded px-2 text-xs font-medium whitespace-nowrap transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            {option.icon}
            <span className={labelClass}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-200 bg-danger-50 px-4 py-3"
    >
      <p className="text-sm text-danger-700">{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Reîncearcă
        </Button>
      )}
    </div>
  );
}
