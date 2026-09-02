/**
 * EditableCell — inline editing inside a DataTable cell.
 *
 * Idle it is just text with a dotted underline that only shows on row hover,
 * so a table of 20 editable columns still reads as data rather than as a form.
 * Click (or Enter on the focused row's cell) swaps in a control sized to the
 * cell; Enter commits, Escape reverts, blur commits.
 *
 * `onSubmit` may return a promise: the cell shows a spinner until it settles
 * and keeps the editor open with an inline message if it rejects, so a failed
 * PATCH never silently drops what the operator typed.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PencilIcon } from './icons';
import { Select } from './Select';
import { Spinner } from './Button';
import { cx } from './utils';
import type { SelectOption } from './types';

export interface EditableCellProps {
  value: string | number | null;
  /** Receives the raw string draft. Throw (or reject) to keep the editor open. */
  onSubmit: (next: string) => void | Promise<unknown>;
  type?: 'text' | 'number' | 'date';
  /** Present ⇒ the editor is a listbox instead of a free-text input. */
  options?: SelectOption<string>[];
  /** Custom read-mode rendering (badge, formatted money, …). */
  display?: ReactNode | ((value: string | number | null) => ReactNode);
  placeholder?: string;
  disabled?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Accessible name for the editor, e.g. "Cantitate". */
  label?: string;
  emptyText?: string;
  /** Return a message to block the commit client-side. */
  validate?: (next: string) => string | null;
  className?: string;
}

export function EditableCell({
  value,
  onSubmit,
  type = 'text',
  options,
  display,
  placeholder = '—',
  disabled = false,
  align = 'left',
  label,
  emptyText = '—',
  validate,
  className,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const abandoned = useRef(false);
  const wasEditing = useRef(false);

  const asString = value === null || value === undefined ? '' : String(value);

  useEffect(() => {
    if (editing && !options) inputRef.current?.select();
  }, [editing, options]);

  // Enter/Escape/a Select pick all unmount the editor synchronously, which
  // drops focus to <body> — reclaim it for the cell. A Tab-away blur has
  // already moved focus to a real element by the time this runs, so this
  // only fires when nothing else claimed it.
  useEffect(() => {
    if (wasEditing.current && !editing) {
      const active = document.activeElement;
      if (active === document.body || active === null) {
        triggerRef.current?.focus({ preventScroll: true });
      }
    }
    wasEditing.current = editing;
  }, [editing]);

  const start = () => {
    if (disabled) return;
    abandoned.current = false;
    setDraft(asString);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    abandoned.current = true;
    setEditing(false);
    setError(null);
  };

  const commit = async (next: string) => {
    if (abandoned.current) return;
    if (next === asString) {
      setEditing(false);
      return;
    }
    const invalid = validate?.(next);
    if (invalid) {
      setError(invalid);
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      await onSubmit(next);
      setEditing(false);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Salvarea a eșuat');
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const alignClass =
    align === 'right' ? 'text-right justify-end' : align === 'center' ? 'text-center justify-center' : 'text-left';

  // Row-level handlers must not see clicks aimed at the editor.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  if (editing && options) {
    return (
      <span className={cx('flex', alignClass, className)} onClick={stop} onDoubleClick={stop}>
        <Select
          size="sm"
          defaultOpen
          value={draft || null}
          options={options}
          searchable={options.length > 8}
          onChange={(next) => {
            setDraft(next);
            void commit(next);
          }}
          onOpenChange={(open) => {
            if (!open && !saving) setEditing(false);
          }}
          className="min-w-0"
        />
      </span>
    );
  }

  if (editing) {
    return (
      <span
        className={cx('relative flex items-center', alignClass, className)}
        onClick={stop}
        onDoubleClick={stop}
      >
        <input
          ref={inputRef}
          autoFocus
          type={type}
          value={draft}
          disabled={saving}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void commit(draft);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
            event.stopPropagation();
          }}
          className={cx(
            'h-7 w-full min-w-0 rounded border bg-surface px-1.5 text-sm text-ink',
            'focus:outline-none focus:ring-2',
            error
              ? 'border-danger-500 ring-danger-500/25'
              : 'border-primary ring-2 ring-primary/25',
            (type === 'number' || align === 'right') && 'text-right tabular',
          )}
        />
        {saving && <Spinner className="absolute right-2 size-3 text-primary" />}
        {error && (
          <span
            role="alert"
            className="absolute top-full left-0 z-20 mt-1 max-w-64 rounded bg-danger-600 px-1.5 py-1 text-xs font-medium text-white shadow-popover"
          >
            {error}
          </span>
        )}
      </span>
    );
  }

  const readView =
    typeof display === 'function' ? display(value) : (display ?? (asString || emptyText));

  return (
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      aria-label={label ? `${label}: editează` : undefined}
      onClick={(event) => {
        event.stopPropagation();
        start();
      }}
      onDoubleClick={stop}
      className={cx(
        'group/cell -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-1 rounded px-1 py-0.5 text-sm',
        'transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        disabled
          ? 'cursor-default text-ink'
          : 'cursor-text hover:bg-surface hover:ring-1 hover:ring-border-strong',
        alignClass,
        className,
      )}
    >
      <span
        className={cx(
          'min-w-0 truncate',
          !asString && 'text-ink-subtle',
          !disabled && 'decoration-border-strong decoration-dotted underline-offset-4 group-hover/cell:underline',
        )}
      >
        {readView || placeholder}
      </span>
      {!disabled && (
        <PencilIcon className="size-3 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover/row:opacity-70 group-hover/cell:opacity-100" />
      )}
    </button>
  );
}
