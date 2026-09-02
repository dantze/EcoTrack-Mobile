/**
 * Select — one listbox, whether or not it filters.
 *
 * Not a native `<select>`: `searchable` needs a filter row inside the popup,
 * which native cannot do, and OS dropdown chrome ignores our type scale, which
 * looks wrong next to the rest of a dense form.
 *
 * Built on shadcn `Popover` + `Command`. Radix owns the positioning (so the
 * popup escapes the `overflow:auto` of a table or a drawer instead of being
 * clipped by it), the outside-click and Escape handling, the focus return, and
 * — the part that is easy to miss — the `pointer-events` of its own portal. A
 * hand-portalled popup inherits `pointer-events: none` from the body while a
 * dialog is open, which is exactly how a select inside a modal stops
 * responding to the mouse.
 *
 * cmdk owns the keyboard model (arrows, Home/End, Enter, typeahead) but NOT
 * the filtering: `shouldFilter={false}`, because the app's filter is
 * diacritic-insensitive — "Ilfov" must match a typed "ilfov" and "Iaşi" a
 * typed "iasi" — and cmdk's built-in scorer is neither.
 */

import { useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/shadcn/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/popover';
import { describedBy, FieldShell } from './Field';
import { cn, controlClass, matches } from './utils';
import { useFieldIds } from './utils';
import type { SelectOption, SelectProps } from './types';

export interface SelectExtraProps {
  /** Explicit control id, so a caller can label or focus this field itself. */
  id?: string;
  /** Allows clearing back to `null` — renders a "—" reset row at the top. */
  clearable?: boolean;
  onClear?: () => void;
  size?: 'sm' | 'md';
  /** Shown in the popup when the filter matches nothing. */
  emptyText?: string;
  /** Opens on mount — EditableCell uses this so one click starts the edit. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** Placeholder for the filter row, when `searchable`. */
  searchPlaceholder?: string;
}

export function Select<V extends string | number = string>({
  id: explicitId,
  label,
  error,
  hint,
  required,
  value,
  options,
  onChange,
  placeholder = 'Selectează…',
  disabled,
  searchable = false,
  clearable = false,
  onClear,
  size = 'md',
  emptyText = 'Niciun rezultat',
  defaultOpen = false,
  onOpenChange,
  className,
  searchPlaceholder = 'Caută…',
}: SelectProps<V> & SelectExtraProps) {
  const { id, hintId, errorId } = useFieldIds(explicitId);
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  // Filtered here rather than by cmdk — see the note at the top of the file.
  const visible = useMemo<SelectOption<V>[]>(() => {
    const trimmed = query.trim();
    if (!searchable || !trimmed) return options;
    return options.filter((option) => matches(option.label, trimmed));
  }, [options, query, searchable]);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
    // The filter belongs to one opening of the popup, and clearing it on close
    // is a write inside the CLOSE event rather than an effect watching `open`
    // (TODO-26) — an effect would clear it one render after the popup has
    // already re-rendered with the stale query.
    if (!next) setQuery('');
  };

  return (
    <FieldShell
      id={id}
      hintId={hintId}
      errorId={errorId}
      label={label}
      error={error}
      hint={hint}
      required={required}
    >
      <Popover open={open} onOpenChange={changeOpen}>
        <div className="relative">
          <PopoverTrigger asChild>
            <button
              ref={triggerRef}
              id={id}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(hintId, errorId, hint, error)}
              disabled={disabled}
              className={cn(
                controlClass(
                  Boolean(error),
                  size,
                  'flex items-center justify-between gap-2 text-left',
                ),
                // Room for the clear button, so a long label never runs under it.
                clearable && selected && 'pr-8',
                className,
              )}
            >
              <span className={cn('truncate', !selected && 'text-ink-subtle')}>
                {selected ? selected.label : placeholder}
              </span>
              <ChevronsUpDown
                aria-hidden
                className="size-3.5 shrink-0 text-ink-subtle opacity-70"
              />
            </button>
          </PopoverTrigger>

          {clearable && selected && !disabled && (
            <button
              type="button"
              aria-label="Golește selecția"
              onClick={(event) => {
                event.stopPropagation();
                onClear?.();
              }}
              className="absolute top-1/2 right-6 grid size-5 -translate-y-1/2 place-items-center rounded text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-(--radix-popover-trigger-width) min-w-44 p-0"
          // The trigger is a form control inside a scrolling drawer; letting
          // the popup stay open while its anchor scrolls away leaves an
          // orphaned list floating over the page.
          onOpenAutoFocus={(event) => {
            if (!searchable) return;
            // With a filter row, focus belongs in it; without one, cmdk's list
            // takes focus itself and typeahead works immediately.
            event.preventDefault();
          }}
        >
          <Command shouldFilter={false} loop>
            {searchable && (
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
                autoFocus
              />
            )}
            <CommandList className="max-h-64">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {clearable && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onClear?.();
                      changeOpen(false);
                    }}
                    className="text-ink-subtle"
                  >
                    <span className="flex-1">—</span>
                  </CommandItem>
                )}
                {visible.map((option) => (
                  <CommandItem
                    key={String(option.value)}
                    value={String(option.value)}
                    disabled={option.disabled}
                    data-checked={option.value === value ? true : undefined}
                    onSelect={() => {
                      onChange(option.value);
                      changeOpen(false);
                      // Focus returns to the trigger so the next Tab continues
                      // through the form rather than restarting at the top.
                      triggerRef.current?.focus();
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.value === value && (
                      <Check aria-hidden className="size-3.5 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FieldShell>
  );
}
