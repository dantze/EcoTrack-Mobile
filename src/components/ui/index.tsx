/**
 * UI kit — minimal working implementations.
 *
 * These render and behave correctly but are visually plain on purpose. The
 * ui-agent replaces the internals (and may split this into one file per
 * component) while keeping every signature in `./types.ts` intact, so feature
 * screens keep compiling throughout.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BadgeProps,
  ButtonProps,
  CheckboxProps,
  Column,
  DataTableProps,
  DateInputProps,
  DrawerProps,
  EmptyStateProps,
  ModalProps,
  PageHeaderProps,
  RowKey,
  SelectProps,
  TabsProps,
  TextAreaProps,
  TextInputProps,
} from './types';

export * from './types';

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-600 disabled:bg-brand-700/40',
  secondary:
    'bg-white text-ink border border-border hover:bg-surface-sunken disabled:opacity-50',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-sunken disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/40',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
        BUTTON_VARIANTS[variant],
        'disabled:cursor-not-allowed',
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

function FieldShell({
  label,
  error,
  hint,
  required,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-medium text-ink-muted">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

const CONTROL =
  'h-8 w-full rounded-md border border-border bg-white px-2.5 text-sm text-ink ' +
  'outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ' +
  'disabled:bg-surface-sunken disabled:text-ink-subtle';

export function TextInput({ label, error, hint, required, className, ...rest }: TextInputProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <input
        {...rest}
        required={required}
        className={cx(CONTROL, error && 'border-red-500', className)}
      />
    </FieldShell>
  );
}

export function TextArea({ label, error, hint, required, className, ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <textarea
        {...rest}
        required={required}
        className={cx(CONTROL, 'h-auto min-h-16 py-1.5', error && 'border-red-500', className)}
      />
    </FieldShell>
  );
}

export function DateInput({
  label,
  error,
  hint,
  required,
  value,
  onChange,
  ...rest
}: DateInputProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <input
        {...rest}
        type="date"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className={cx(CONTROL, error && 'border-red-500')}
      />
    </FieldShell>
  );
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
}: SelectProps<V>) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      <select
        value={value === null ? '' : String(value)}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          const match = options.find((option) => String(option.value) === raw);
          if (match) onChange(match.value);
        }}
        className={cx(CONTROL, error && 'border-red-500')}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Checkbox({ checked, onChange, label, indeterminate, disabled }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 accent-brand-700"
      />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const BADGE_TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-blue-50 text-blue-700',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-white px-5 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-muted">{body}</p>}
      {action}
    </div>
  );
}

export function Tabs({ items, active, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-white px-5">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            item.id === active
              ? 'border-brand-700 text-brand-700'
              : 'border-transparent text-ink-muted hover:text-ink',
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="ml-1.5 text-xs text-ink-subtle tabular">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

const MODAL_WIDTHS = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export function Modal({ open, onClose, title, children, footer, width = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-8">
      <div
        role="dialog"
        aria-modal
        className={cx('w-full rounded-lg bg-white shadow-xl', MODAL_WIDTHS[width])}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Închide">
            ✕
          </Button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

const DRAWER_WIDTHS = { md: 'w-[28rem]', lg: 'w-[36rem]', xl: 'w-[44rem]' };

export function Drawer({ open, onClose, title, children, footer, width = 'lg' }: DrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <aside className={cx('flex h-full flex-col bg-white shadow-xl', DRAWER_WIDTHS[width])}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Închide">
            ✕
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  empty,
  onRowClick,
  activeKey = null,
  selectedKeys,
  onSelectionChange,
  bulkActions,
  density = 'compact',
  stickyHeader = true,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const selectable = Boolean(selectedKeys && onSelectionChange);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
      const a = column.sortValue!(left);
      const b = column.sortValue!(right);
      if (a === b) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return (a < b ? -1 : 1) * factor;
    });
  }, [rows, columns, sort]);

  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, dir: 'asc' },
    );
  };

  const allSelected = selectable && sorted.length > 0 &&
    sorted.every((row) => selectedKeys!.has(rowKey(row)));

  const toggleAll = (checked: boolean) => {
    const next = new Set<RowKey>(checked ? sorted.map(rowKey) : []);
    onSelectionChange!(next);
  };

  const toggleRow = (key: RowKey, checked: boolean) => {
    const next = new Set(selectedKeys!);
    if (checked) next.add(key);
    else next.delete(key);
    onSelectionChange!(next);
  };

  const cellPadding = density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-2.5';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {selectable && selectedKeys!.size > 0 && (
        <div className="flex items-center gap-3 border-b border-border bg-brand-50 px-4 py-2 text-sm">
          <span className="font-medium tabular">{selectedKeys!.size} selectate</span>
          {bulkActions}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className={cx(stickyHeader && 'sticky top-0 z-10')}>
            <tr className="bg-surface-sunken">
              {selectable && (
                <th className={cx('w-9 border-b border-border', cellPadding)}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selectedKeys!.size > 0}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  onClick={() => toggleSort(column)}
                  className={cx(
                    'border-b border-border text-xs font-semibold whitespace-nowrap text-ink-muted',
                    cellPadding,
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    !column.align && 'text-left',
                    column.sortValue && 'cursor-pointer select-none hover:text-ink',
                  )}
                >
                  {column.header}
                  {sort?.key === column.key && (
                    <span className="ml-1">{sort.dir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-12 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)}>
                  {empty ?? <EmptyState title="Niciun rezultat" />}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={cx(
                      'border-b border-border/60 bg-white',
                      onRowClick && 'cursor-pointer hover:bg-surface-sunken',
                      activeKey === key && 'bg-brand-50 hover:bg-brand-50',
                    )}
                  >
                    {selectable && (
                      <td className={cellPadding} onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedKeys!.has(key)}
                          onChange={(checked) => toggleRow(key, checked)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cx(
                          cellPadding,
                          'align-middle',
                          column.align === 'right' && 'text-right tabular',
                          column.align === 'center' && 'text-center',
                        )}
                      >
                        {column.render
                          ? column.render(row)
                          : String((row as Record<string, unknown>)[column.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
