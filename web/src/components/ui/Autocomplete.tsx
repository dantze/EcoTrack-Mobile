/**
 * Autocomplete — a free-text input with a ranked suggestion list.
 *
 * Different from `Select` on purpose. Select is a listbox: the value must be
 * one of the options. Autocomplete is an editable combobox: what the user
 * types IS the value, and the list only offers shortcuts. That is what an
 * address field needs — the operator can type any address, but nine times out
 * of ten they want one this client has used before.
 *
 * Matching is `lib/search`: diacritic-insensitive, multi-term, fuzzy, with the
 * matched characters highlighted so it is obvious why a row is in the list.
 *
 * Keyboard model (WAI-ARIA combobox with list autocomplete):
 *   ↓ / ↑     move through suggestions (opens the list if closed)
 *   Enter     accept the highlighted suggestion, else submit the typed text
 *   Escape    close the list, keeping what was typed
 *   Tab       close and move on
 * The popup is portalled to `document.body` and positioned from the input, so
 * it is not clipped by a drawer's `overflow:auto`.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { rankBy, splitHighlight, type MatchRange } from '@/lib/search';
import { describedBy, FieldShell } from './Field';
import { controlClass, cx, useFieldIds, useOutsideClick } from './utils';
import type { FieldProps } from './types';

export interface AutocompleteOption {
  /** Committed to the input when the row is accepted. */
  value: string;
  /** Primary line. Defaults to `value`. */
  label?: string;
  /** Secondary line — where the suggestion came from, a count, a date. */
  hint?: string;
  /** Optional section heading; consecutive rows sharing one are grouped. */
  group?: string;
}

interface PopupRect {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

const POPUP_GAP = 4;
const MIN_POPUP_HEIGHT = 160;
const MAX_POPUP_HEIGHT = 300;

export interface AutocompleteProps extends FieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  /** Fired in addition to `onChange` when a suggestion row is accepted. */
  onSelect?: (option: AutocompleteOption) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Shown when the field has text but nothing matches. */
  emptyText?: string;
  maxResults?: number;
  /** Offer the full (ranked) list when the field is empty and focused. */
  openOnFocus?: boolean;
  className?: string;
  leading?: React.ReactNode;
  autoFocus?: boolean;
}

export function Autocomplete({
  id: explicitId,
  label,
  error,
  hint,
  required,
  value,
  onChange,
  options,
  onSelect,
  placeholder,
  disabled,
  emptyText = 'Nicio sugestie',
  maxResults = 8,
  openOnFocus = true,
  className,
  leading,
  autoFocus,
}: AutocompleteProps) {
  const { id, hintId, errorId } = useFieldIds(explicitId);
  const generatedId = useId();
  const listId = `${generatedId}-listbox`;

  const [open, setOpen] = useState(false);
  const [storedHighlight, setHighlight] = useState(-1);
  const [rect, setRect] = useState<PopupRect | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = value.trim();
    const ranked = query
      ? rankBy(options, query, (option) => [option.label ?? option.value, option.hint], {
          limit: maxResults,
        }).map(({ item, ranges }) => ({ item, ranges }))
      : options.slice(0, maxResults).map((option) => ({ item: option, ranges: [] as MatchRange[] }));

    // Keep the caller's group order (client's own sites before everyone
    // else's) and let relevance decide only *within* a group — Array.sort is
    // stable, so the ranking survives. A list whose headings interleave reads
    // like noise even when every row is individually well ranked.
    const groupOrder: string[] = [];
    for (const option of options) {
      const group = option.group ?? '';
      if (!groupOrder.includes(group)) groupOrder.push(group);
    }
    return [...ranked].sort(
      (left, right) =>
        groupOrder.indexOf(left.item.group ?? '') - groupOrder.indexOf(right.item.group ?? ''),
    );
  }, [options, value, maxResults]);

  // An exact hit is not a suggestion — hide the list once the typed text
  // already equals the only thing on offer.
  const redundant =
    matches.length === 1 && (matches[0]!.item.label ?? matches[0]!.item.value) === value;
  const visible = open && matches.length > 0 && !redundant;

  useOutsideClick([wrapperRef, popupRef], visible, () => setOpen(false));

  useLayoutEffect(() => {
    if (!visible) return;

    const measure = () => {
      const input = inputRef.current;
      if (!input) return;
      const box = input.getBoundingClientRect();
      const below = window.innerHeight - box.bottom - 8;
      const above = box.top - 8;
      const openUp = below < MIN_POPUP_HEIGHT && above > below;

      setRect({
        left: box.left,
        width: box.width,
        maxHeight: Math.max(120, Math.min(MAX_POPUP_HEIGHT, openUp ? above : below)),
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
  }, [visible]);

  // Clamped on READ rather than corrected in an effect (TODO-26). Typing shrinks
  // `matches` during render, so a stored index outlives the row it pointed at: an
  // effect fixes it one render too late, and that render is a real one — the
  // listbox draws a highlight on nothing and `matches[highlight]` is undefined,
  // so Enter silently accepts nothing. -1 stays reachable and still means "no
  // suggestion is highlighted", which is why there is no lower bound here.
  const highlight = Math.min(storedHighlight, matches.length - 1);

  useEffect(() => {
    if (!visible) return;
    popupRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight, visible]);

  const accept = (option: AutocompleteOption) => {
    onChange(option.value);
    onSelect?.(option);
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.focus();
  };

  const step = (delta: number) => {
    if (matches.length === 0) return;
    if (!open) {
      setOpen(true);
      setHighlight(delta > 0 ? 0 : matches.length - 1);
      return;
    }
    const next = highlight + delta;
    if (next < 0) setHighlight(matches.length - 1);
    else if (next >= matches.length) setHighlight(0);
    else setHighlight(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        step(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        step(-1);
        break;
      case 'Enter': {
        const option = visible && highlight >= 0 ? matches[highlight]?.item : undefined;
        if (option) {
          event.preventDefault();
          accept(option);
        }
        break;
      }
      case 'Escape':
        if (visible) {
          // Stop the drawer or modal above from closing on the same Escape.
          event.stopPropagation();
          event.preventDefault();
          setOpen(false);
          setHighlight(-1);
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  let lastGroup: string | undefined;

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
      <div ref={wrapperRef} className="relative flex items-center">
        {leading && (
          <span className="pointer-events-none absolute left-2.5 flex items-center text-ink-subtle [&>svg]:size-4">
            {leading}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={visible}
          aria-haspopup="listbox"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errorId, hint, error)}
          aria-controls={visible ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            visible && highlight >= 0 ? `${listId}-${highlight}` : undefined
          }
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => {
            if (openOnFocus) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={controlClass(Boolean(error), 'md', cx(Boolean(leading) && 'pl-8', className))}
        />
      </div>

      {visible &&
        rect &&
        createPortal(
          <div
            ref={popupRef}
            style={{
              position: 'fixed',
              left: rect.left,
              top: rect.top,
              bottom: rect.bottom,
              width: Math.max(rect.width, 220),
              maxHeight: rect.maxHeight,
            }}
            className="z-[80] flex animate-scale-in flex-col overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-popover"
          >
            {/* Distinct from the field's own label: both are in the a11y tree
                at once, and two nodes answering to "Adresă" is ambiguous. */}
            <ul id={listId} role="listbox" aria-label={label ? `Sugestii pentru ${label}` : 'Sugestii'}>
              {matches.length === 0 ? (
                <li className="px-2 py-3 text-center text-xs text-ink-subtle">{emptyText}</li>
              ) : (
                matches.map(({ item, ranges }, index) => {
                  const text = item.label ?? item.value;
                  const heading = item.group && item.group !== lastGroup ? item.group : null;
                  lastGroup = item.group;
                  return (
                    <li key={`${item.value}-${index}`}>
                      {heading && (
                        <p className="px-2 pt-2 pb-1 text-[0.6875rem] font-semibold tracking-wide text-ink-subtle uppercase">
                          {heading}
                        </p>
                      )}
                      <div
                        id={`${listId}-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={index === highlight}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => accept(item)}
                        className={cx(
                          'cursor-pointer rounded px-2 py-1.5 text-sm',
                          index === highlight ? 'bg-brand-50 text-brand-700' : 'text-ink',
                        )}
                      >
                        <span className="block truncate">
                          {splitHighlight(text, ranges).map((part, partIndex) =>
                            part.hit ? (
                              <mark
                                key={partIndex}
                                className="bg-transparent font-semibold text-brand-700"
                              >
                                {part.text}
                              </mark>
                            ) : (
                              <span key={partIndex}>{part.text}</span>
                            ),
                          )}
                        </span>
                        {item.hint && (
                          <span className="block truncate text-xs text-ink-subtle">
                            {item.hint}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </FieldShell>
  );
}
