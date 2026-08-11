/**
 * FilterBar — the strip that sits between the page header and the table.
 *
 * Search on the left, toggle chips next to it, caller-supplied controls (a
 * Select, a date range) on the right. Chips are multi-select by default; a bar
 * with `single` behaves like a segmented filter instead.
 *
 * Pressing `/` anywhere on the page focuses the search box, unless the user is
 * already typing in a field.
 */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { CloseIcon, SearchIcon } from './icons';
import { cx, FOCUS_RING } from './utils';

export interface FilterChip {
  id: string;
  label: ReactNode;
  count?: number;
}

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Bind the `/` shortcut to this input. On by default. */
  shortcut?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Caută…',
  shortcut = true,
  className,
  ariaLabel = 'Caută',
}: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcut]);

  return (
    <div className={cx('relative flex items-center', className ?? 'w-64')}>
      <SearchIcon className="pointer-events-none absolute left-2.5 size-3.5 text-ink-subtle" />
      <input
        ref={ref}
        type="search"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            onChange('');
          }
        }}
        className={cx(
          'h-7 w-full rounded-md border border-border bg-white pr-7 pl-8 text-sm text-ink',
          'placeholder:text-ink-subtle hover:border-border-strong',
          'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Golește căutarea"
          className="absolute right-1.5 rounded p-0.5 text-ink-subtle transition-colors hover:bg-slate-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
        >
          <CloseIcon className="size-3" />
        </button>
      )}
    </div>
  );
}

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  chips?: FilterChip[];
  activeChipIds?: string[];
  onChipToggle?: (id: string) => void;
  /** Renders chips as a single-choice segmented control. */
  single?: boolean;
  /** Shown when anything is active; clears the whole bar. */
  onReset?: () => void;
  /** Extra controls, right-aligned (Select, DateInput, buttons). */
  children?: ReactNode;
  className?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  chips,
  activeChipIds = [],
  onChipToggle,
  single = false,
  onReset,
  children,
  className,
}: FilterBarProps) {
  const dirty = Boolean(search) || activeChipIds.length > 0;

  return (
    <div
      className={cx(
        'flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-white px-5 py-2',
        className,
      )}
    >
      {onSearchChange && (
        <SearchInput
          value={search ?? ''}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
      )}

      {chips && chips.length > 0 && (
        <div
          className={cx('flex flex-wrap items-center gap-1', single && 'rounded-md bg-surface-sunken p-0.5')}
          role={single ? 'radiogroup' : undefined}
        >
          {chips.map((chip) => {
            const active = activeChipIds.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                role={single ? 'radio' : undefined}
                aria-checked={single ? active : undefined}
                aria-pressed={single ? undefined : active}
                onClick={() => onChipToggle?.(chip.id)}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                  'transition-colors whitespace-nowrap',
                  single
                    ? active
                      ? 'bg-white text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                    : active
                      ? 'bg-brand-700 text-white'
                      : 'border border-border bg-white text-ink-muted hover:border-border-strong hover:text-ink',
                  FOCUS_RING,
                )}
              >
                {chip.label}
                {chip.count !== undefined && (
                  <span
                    className={cx(
                      'tabular text-[0.6875rem]',
                      active && !single ? 'text-white/70' : 'text-ink-subtle',
                    )}
                  >
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {onReset && dirty && (
        <button
          type="button"
          onClick={onReset}
          className={cx(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-muted',
            'transition-colors hover:bg-slate-100 hover:text-ink',
            FOCUS_RING,
          )}
        >
          <CloseIcon className="size-3" />
          Resetează
        </button>
      )}

      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
