/**
 * FilterBar — the strip that sits between the command bar and the table.
 *
 * Search on the left, the active filters next to it as dismissable chips,
 * caller-supplied controls (a Select, a date range) on the right. Chips are
 * multi-select by default; a bar with `single` behaves like a segmented
 * filter instead, where "dismissable" makes no sense and is therefore off.
 *
 * The chip row is the part that breaks on a phone: eight chips wrapping onto
 * four lines pushes the table off screen. Below `md` it becomes one row that
 * scrolls sideways inside itself, so the strip keeps a fixed height and the
 * page never scrolls sideways.
 *
 * Pressing `/` anywhere on the page focuses the search box, unless the user is
 * already typing in a field — hence the `/` hint in the trailing slot, which
 * an empty, unfocused input wears the way Outlook wears its shortcut hints.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Badge } from '@/components/shadcn/badge';
import { Button } from '@/components/shadcn/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/shadcn/input-group';
import { Kbd } from '@/components/shadcn/kbd';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from './utils';

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
  /**
   * Trailing hint, shown only while the box is empty and unfocused — the clear
   * button owns that corner otherwise. Defaults to the `/` key when `shortcut`
   * is on; pass a node for a different one, or `null` for none.
   */
  hint?: ReactNode;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Caută…',
  shortcut = true,
  className,
  ariaLabel = 'Caută',
  hint,
}: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

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

  const resolvedHint = hint === undefined ? (shortcut ? <Kbd>/</Kbd> : null) : hint;
  const showHint = Boolean(resolvedHint) && !value && !focused;

  return (
    <InputGroup className={cn('h-8 bg-surface', className ?? 'w-64 max-w-full')}>
      <InputGroupAddon>
        <Search className="text-ink-subtle" />
      </InputGroupAddon>

      <InputGroupInput
        ref={ref}
        type="search"
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            onChange('');
          }
        }}
        className="text-sm text-ink placeholder:text-ink-subtle [&::-webkit-search-cancel-button]:hidden"
      />

      {(value || showHint) && (
        <InputGroupAddon align="inline-end">
          {value ? (
            <InputGroupButton
              type="button"
              size="icon-xs"
              aria-label="Golește căutarea"
              onClick={() => {
                onChange('');
                ref.current?.focus();
              }}
            >
              <X />
            </InputGroupButton>
          ) : (
            resolvedHint
          )}
        </InputGroupAddon>
      )}
    </InputGroup>
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
  /** Shown when more than one filter is active; clears the whole bar. */
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
  // The search box counts as one filter: clearing "everything" with a single
  // chip active is a button that undoes one click, which is noise.
  const activeCount = activeChipIds.length + (search ? 1 : 0);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5',
        'max-md:flex-wrap',
        className,
      )}
    >
      {onSearchChange && (
        <SearchInput
          value={search ?? ''}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-64 max-w-full max-md:w-full"
        />
      )}

      {chips && chips.length > 0 && (
        <div
          role={single ? 'radiogroup' : undefined}
          className={cn(
            // One sideways-scrolling row on a phone, free-wrapping above it.
            'flex min-w-0 items-center gap-1 overflow-x-auto md:flex-wrap md:overflow-visible',
            single && 'rounded-lg bg-surface-sunken p-0.5',
          )}
        >
          {chips.map((chip) => {
            const active = activeChipIds.includes(chip.id);
            // A dismissable chip is one control, not two: the whole chip
            // toggles, and the × is a label for what a click will do. Nesting
            // a real button inside a button is invalid and unreachable by
            // keyboard anyway.
            return (
              <button
                key={chip.id}
                type="button"
                role={single ? 'radio' : undefined}
                aria-checked={single ? active : undefined}
                aria-pressed={single ? undefined : active}
                onClick={() => onChipToggle?.(chip.id)}
                className={cn('shrink-0 rounded-4xl', FOCUS_RING)}
              >
                <Badge
                  variant={active && !single ? 'default' : single ? 'ghost' : 'outline'}
                  className={cn(
                    'h-6 cursor-pointer gap-1 px-2 transition-colors',
                    single
                      ? active
                        ? 'rounded-md bg-surface text-ink shadow-xs'
                        : 'rounded-md text-ink-muted hover:text-ink'
                      : active
                        ? ''
                        : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  <span className="truncate">{chip.label}</span>
                  {chip.count !== undefined && (
                    <span className={cn('tabular', active && !single ? 'opacity-70' : 'text-ink-subtle')}>
                      {chip.count}
                    </span>
                  )}
                  {active && !single && <X aria-hidden className="opacity-70" />}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {onReset && activeCount > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onReset}
          className="shrink-0 text-ink-muted"
        >
          <X />
          Șterge filtrele
        </Button>
      )}

      {children && (
        <div className="flex flex-wrap items-center gap-2 md:ml-auto max-md:w-full">{children}</div>
      )}
    </div>
  );
}
