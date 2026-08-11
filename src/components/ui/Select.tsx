/**
 * Select — a custom listbox rather than a native `<select>`.
 *
 * Two reasons: `searchable` needs a filter row inside the popup, which native
 * cannot do; and a native dropdown renders in OS chrome that ignores our type
 * scale, which looks wrong next to the rest of a dense form.
 *
 * The popup is portalled to `document.body` and positioned from the trigger
 * rect, so it escapes the `overflow:auto` of a table or drawer instead of being
 * clipped by it. Full listbox keyboard model: type to filter, arrows to move,
 * Enter to pick, Esc to close, Home/End to jump.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { describedBy, FieldShell } from './Field';
import { CheckIcon, ChevronDownIcon, SearchIcon } from './icons';
import {
  controlClass,
  cx,
  matches,
  useEscapeKey,
  useEvent,
  useFieldIds,
  useOutsideClick,
} from './utils';
import type { SelectOption, SelectProps } from './types';

interface PopupRect {
  left: number;
  width: number;
  maxHeight: number;
  /** Exactly one of these is set — `bottom` when the popup flips above. */
  top?: number;
  bottom?: number;
}

const POPUP_GAP = 4;
const MIN_POPUP_HEIGHT = 168;
const MAX_POPUP_HEIGHT = 288;

export interface SelectExtraProps {
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
}

export function Select<V extends string | number = string>({
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
}: SelectProps<V> & SelectExtraProps) {
  const { id, hintId, errorId } = useFieldIds();
  const listId = `${id}-listbox`;

  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<PopupRect | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const visible = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    return options.filter((option) => matches(option.label, query));
  }, [options, query, searchable]);

  const close = (returnFocus = true) => {
    setOpen(false);
    setQuery('');
    if (returnFocus) triggerRef.current?.focus();
  };

  // Report open/close transitions only — not the initial state.
  const openChanged = useEvent((next: boolean) => onOpenChange?.(next));
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (!open) return;
    }
    openChanged(open);
  }, [open, openChanged]);

  useEscapeKey(open, () => close());
  useOutsideClick([triggerRef, popupRef], open, () => close(false));

  // Position from the trigger, flipping above when the viewport is tight.
  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const box = trigger.getBoundingClientRect();
      const below = window.innerHeight - box.bottom - 8;
      const above = box.top - 8;
      const openUp = below < MIN_POPUP_HEIGHT && above > below;

      setRect({
        left: box.left,
        width: box.width,
        maxHeight: Math.max(120, Math.min(MAX_POPUP_HEIGHT, openUp ? above : below)),
        // Anchoring by `bottom` when flipped avoids a transform, which would
        // otherwise fight the open animation.
        ...(openUp
          ? { bottom: window.innerHeight - box.top + POPUP_GAP }
          : { top: box.bottom + POPUP_GAP }),
      });
    };

    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  // Open with the current value under the cursor; re-clamp as the filter narrows.
  useEffect(() => {
    if (!open) return;
    const index = visible.findIndex((option) => option.value === value);
    setHighlight(index >= 0 ? index : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (highlight > visible.length - 1) setHighlight(Math.max(0, visible.length - 1));
  }, [visible.length, highlight]);

  // Without a filter row there is nothing else to hold focus, so the list takes it.
  useEffect(() => {
    if (open && !searchable) listRef.current?.focus({ preventScroll: true });
  }, [open, searchable]);

  // Keep the highlighted row in view during keyboard traversal.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const commit = (option: SelectOption<V>) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };

  const step = (delta: number) => {
    if (visible.length === 0) return;
    let next = highlight;
    for (let attempt = 0; attempt < visible.length; attempt += 1) {
      next = (next + delta + visible.length) % visible.length;
      if (!visible[next]?.disabled) break;
    }
    setHighlight(next);
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        step(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        step(-1);
        break;
      case 'Home':
        event.preventDefault();
        setHighlight(0);
        break;
      case 'End':
        event.preventDefault();
        setHighlight(Math.max(0, visible.length - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const option = visible[highlight];
        if (option) commit(option);
        break;
      }
      case 'Tab':
        close(false);
        break;
      default:
        break;
    }
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
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
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        className={cx(
          controlClass(Boolean(error), size, 'flex items-center justify-between gap-2 text-left'),
          open && 'border-brand-500 ring-2 ring-brand-500/25',
          className,
        )}
      >
        <span className={cx('truncate', !selected && 'text-ink-subtle')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon
          className={cx(
            'size-4 shrink-0 text-ink-subtle transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: 'fixed',
              left: rect.left,
              top: rect.top,
              bottom: rect.bottom,
              width: Math.max(rect.width, 180),
              maxHeight: rect.maxHeight,
            }}
            className="z-[60] flex animate-scale-in flex-col overflow-hidden rounded-lg border border-border bg-white shadow-popover"
          >
            {searchable && (
              <div className="relative shrink-0 border-b border-border p-1.5">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-ink-subtle" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlight(0);
                  }}
                  onKeyDown={onListKeyDown}
                  placeholder="Caută…"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    visible[highlight] ? `${listId}-${highlight}` : undefined
                  }
                  className="h-7 w-full rounded border-0 bg-transparent pr-2 pl-7 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
                />
              </div>
            )}

            <div
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={searchable ? -1 : 0}
              onKeyDown={searchable ? undefined : onListKeyDown}
              aria-activedescendant={visible[highlight] ? `${listId}-${highlight}` : undefined}
              className="min-h-0 flex-1 overflow-y-auto p-1 focus:outline-none"
            >
              {clearable && selected && (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onClear?.();
                    close();
                  }}
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-ink-muted hover:bg-surface-sunken"
                >
                  Șterge selecția
                </button>
              )}

              {visible.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-ink-subtle">{emptyText}</p>
              ) : (
                visible.map((option, index) => {
                  const isSelected = option.value === value;
                  const isActive = index === highlight;
                  return (
                    <div
                      key={String(option.value)}
                      id={`${listId}-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => !option.disabled && setHighlight(index)}
                      onClick={() => commit(option)}
                      className={cx(
                        'flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm',
                        option.disabled && 'cursor-not-allowed text-ink-subtle',
                        !option.disabled && isActive && 'bg-brand-50 text-brand-700',
                        !option.disabled && !isActive && 'text-ink',
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && <CheckIcon className="size-4 shrink-0 text-brand-600" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </FieldShell>
  );
}
