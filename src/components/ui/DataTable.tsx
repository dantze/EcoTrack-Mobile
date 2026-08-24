/**
 * DataTable — the screen, not a widget on it.
 *
 * Layout notes that matter for a back-office grid:
 *
 * - `border-separate` (not `collapse`) so sticky header cells keep their
 *   borders while the body scrolls under them.
 * - `table-fixed` + a `<colgroup>`: columns keep the width the caller asked
 *   for, cells truncate instead of pushing the layout around, and columns
 *   without a width share the remainder like `1fr`.
 * - The scroll container owns both axes and is `min-w-0`, so a wide table
 *   scrolls inside itself and never widens the page.
 * - Loading renders skeleton rows in the real column geometry, so nothing
 *   jumps when data lands.
 *
 * Keyboard: ↑/↓ move the row cursor, Home/End jump, Enter opens the row,
 * Space toggles its checkbox. Shift-click a checkbox to select a range.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Checkbox } from './Checkbox';
import { EmptyState } from './EmptyState';
import { SortIcon } from './icons';
import { compareValues, cx } from './utils';
import type { Column, DataTableProps, RowKey } from './types';

export interface DataTableColumn<T> extends Column<T> {
  /** Right-aligns and applies tabular figures. Use for money, counts, ids. */
  numeric?: boolean;
  /** Lets the cell wrap onto several lines instead of truncating. */
  wrap?: boolean;
  cellClassName?: string;
  /** Long-form column explanation, surfaced as the header `title`. */
  headerTitle?: string;
}

export type SortState = { key: string; dir: 'asc' | 'desc' } | null;

export interface DataTableExtendedProps<T> extends Omit<DataTableProps<T>, 'columns'> {
  columns: DataTableColumn<T>[];
  /** Sort applied on first render; the table owns the state from then on. */
  initialSort?: SortState;
  /** Observe sorting, e.g. to persist it in the URL. */
  onSortChange?: (sort: SortState) => void;
  /** Skeleton rows drawn while `loading` with no data yet. */
  skeletonRows?: number;
  rowClassName?: (row: T) => string | undefined;
  onRowDoubleClick?: (row: T) => void;
  /** Keeps the checkbox column pinned while scrolling sideways. */
  stickySelection?: boolean;
  /** Accessible name for the `<table>` — the page title rarely doubles as one. */
  ariaLabel?: string;
  className?: string;
}

const DENSITY = {
  compact: { cell: 'px-3 py-1.5', head: 'px-3 py-2' },
  comfortable: { cell: 'px-3.5 py-2.5', head: 'px-3.5 py-2.5' },
} as const;

const SELECT_COL_WIDTH = '2.25rem';
const DEFAULT_COL_REM = 9;

/** Rough px→rem budget per column, used only to decide when to scroll sideways. */
function widthInRem(width?: string): number {
  if (!width) return DEFAULT_COL_REM;
  const value = Number.parseFloat(width);
  if (Number.isNaN(value)) return DEFAULT_COL_REM;
  if (width.endsWith('rem') || width.endsWith('em')) return value;
  if (width.endsWith('px')) return value / 16;
  return DEFAULT_COL_REM;
}

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
  initialSort = null,
  onSortChange,
  skeletonRows = 8,
  rowClassName,
  onRowDoubleClick,
  stickySelection = true,
  ariaLabel,
  className,
}: DataTableExtendedProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [cursor, setCursor] = useState(0);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const lastToggledIndex = useRef<number | null>(null);
  const shiftHeld = useRef(false);

  const selectable = Boolean(selectedKeys && onSelectionChange);
  const pad = DENSITY[density];
  const columnCount = columns.length + (selectable ? 1 : 0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    const sortValue = column.sortValue;
    return [...rows].sort((left, right) => {
      const result = compareValues(sortValue(left), sortValue(right));
      // Nulls sink to the bottom in both directions — an empty cell is never
      // "the biggest value".
      return result === 0 ? 0 : result * factor;
    });
  }, [rows, columns, sort]);

  const minWidth = useMemo(() => {
    const body = columns.reduce((total, column) => total + widthInRem(column.width), 0);
    return `${body + (selectable ? 2.25 : 0)}rem`;
  }, [columns, selectable]);

  const applySort = (column: DataTableColumn<T>) => {
    if (!column.sortValue) return;
    setSort((current) => {
      const next: SortState =
        current?.key !== column.key
          ? { key: column.key, dir: 'asc' }
          : current.dir === 'asc'
            ? { key: column.key, dir: 'desc' }
            : null;
      onSortChange?.(next);
      return next;
    });
  };

  // ---- selection ----------------------------------------------------------

  const allSelected =
    selectable && sorted.length > 0 && sorted.every((row) => selectedKeys!.has(rowKey(row)));
  const someSelected = selectable && sorted.some((row) => selectedKeys!.has(rowKey(row)));

  const toggleAll = (checked: boolean) => {
    onSelectionChange!(checked ? new Set(sorted.map(rowKey)) : new Set());
    lastToggledIndex.current = null;
  };

  const toggleRow = (index: number, checked: boolean, extendRange = false) => {
    const next = new Set(selectedKeys!);
    const from = extendRange && lastToggledIndex.current !== null ? lastToggledIndex.current : index;
    const [start, end] = from <= index ? [from, index] : [index, from];

    for (let cursorIndex = start; cursorIndex <= end; cursorIndex += 1) {
      const row = sorted[cursorIndex];
      if (!row) continue;
      const key = rowKey(row);
      if (checked) next.add(key);
      else next.delete(key);
    }

    lastToggledIndex.current = index;
    onSelectionChange!(next);
  };

  // ---- keyboard -----------------------------------------------------------

  const focusRow = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, sorted.length - 1));
      setCursor(clamped);
      const element = bodyRef.current?.querySelector<HTMLTableRowElement>(
        `tr[data-index="${clamped}"]`,
      );
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: 'nearest' });
    },
    [sorted.length],
  );

  const onRowKeyDown = (event: React.KeyboardEvent, row: T, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusRow(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusRow(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusRow(0);
        break;
      case 'End':
        event.preventDefault();
        focusRow(sorted.length - 1);
        break;
      case 'Enter':
        if (onRowClick) {
          event.preventDefault();
          onRowClick(row);
        }
        break;
      case ' ':
        if (selectable) {
          event.preventDefault();
          toggleRow(index, !selectedKeys!.has(rowKey(row)));
        }
        break;
      default:
        break;
    }
  };

  // ---- cells --------------------------------------------------------------

  const alignClass = (column: DataTableColumn<T>) => {
    const align = column.align ?? (column.numeric ? 'right' : 'left');
    return cx(
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      align === 'left' && 'text-left',
      (column.numeric || align === 'right') && 'tabular',
    );
  };

  const renderCell = (column: DataTableColumn<T>, row: T): ReactNode => {
    if (column.render) return column.render(row);
    const raw = (row as Record<string, unknown>)[column.key];
    return raw === null || raw === undefined || raw === '' ? (
      <span className="text-ink-subtle">—</span>
    ) : (
      String(raw)
    );
  };

  const showSkeleton = loading && rows.length === 0;

  return (
    <div className={cx('relative flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      {selectable && selectedKeys!.size > 0 && (
        <div className="flex shrink-0 animate-slide-up items-center gap-3 border-b border-brand-100 bg-brand-50 px-4 py-1.5">
          <span className="tabular text-sm font-medium text-brand-700">
            {selectedKeys!.size}{' '}
            {selectedKeys!.size === 1 ? 'rând selectat' : 'rânduri selectate'}
          </span>
          <button
            type="button"
            onClick={() => onSelectionChange!(new Set())}
            className="rounded px-1.5 py-0.5 text-xs text-brand-600 transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
          >
            Deselectează
          </button>
          <div className="ml-auto flex items-center gap-2">{bulkActions}</div>
        </div>
      )}

      {/* Refetch over existing rows: a hairline instead of blanking the table. */}
      {loading && rows.length > 0 && (
        <div className="absolute inset-x-0 top-0 z-30 h-0.5 animate-pulse bg-brand-500/60" aria-hidden />
      )}

      <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain">
        <table
          className="w-full border-separate border-spacing-0 text-left text-sm"
          style={{ minWidth, tableLayout: 'fixed' }}
          aria-busy={loading || undefined}
          aria-label={ariaLabel}
        >
          <colgroup>
            {selectable && <col style={{ width: SELECT_COL_WIDTH }} />}
            {columns.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              {selectable && (
                <th
                  scope="col"
                  className={cx(
                    'border-b border-border bg-surface-header',
                    pad.head,
                    stickyHeader && 'sticky top-0 z-30',
                    stickySelection && 'sticky left-0',
                  )}
                >
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    ariaLabel="Selectează toate rândurile"
                  />
                </th>
              )}

              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                const sortable = Boolean(column.sortValue);
                return (
                  <th
                    key={column.key}
                    scope="col"
                    title={column.headerTitle}
                    aria-sort={isSorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cx(
                      'group/th border-b border-border bg-surface-header font-semibold',
                      'text-[0.6875rem] tracking-wide whitespace-nowrap uppercase',
                      isSorted ? 'text-brand-700' : 'text-ink-muted',
                      pad.head,
                      alignClass(column),
                      stickyHeader && 'sticky top-0 z-20',
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => applySort(column)}
                        className={cx(
                          'inline-flex max-w-full items-center gap-1 rounded-sm transition-colors hover:text-ink',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                          (column.align === 'right' || column.numeric) && 'flex-row-reverse',
                        )}
                      >
                        <span className="truncate">{column.header}</span>
                        <SortIcon direction={isSorted ? sort!.dir : undefined} />
                      </button>
                    ) : (
                      <span className="block truncate">{column.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody ref={bodyRef}>
            {showSkeleton &&
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="bg-white">
                  {selectable && (
                    <td className={cx('border-b border-border/60', pad.cell)}>
                      <span className="block size-4 animate-pulse rounded bg-slate-200/80" />
                    </td>
                  )}
                  {columns.map((column, columnIndex) => (
                    <td key={column.key} className={cx('border-b border-border/60', pad.cell)}>
                      <span
                        className="block h-3 animate-pulse rounded bg-slate-200/80"
                        style={{
                          // Deterministic ragged widths read as text, not as bars.
                          width: `${[70, 45, 60, 85, 55][(rowIndex + columnIndex) % 5]}%`,
                          animationDelay: `${rowIndex * 60}ms`,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}

            {!showSkeleton && sorted.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="bg-white">
                  {empty ?? (
                    <EmptyState
                      size="sm"
                      title="Niciun rezultat"
                      body="Ajustează filtrele sau caută altceva."
                    />
                  )}
                </td>
              </tr>
            )}

            {!showSkeleton &&
              sorted.map((row, index) => {
                const key = rowKey(row);
                const isActive = activeKey === key;
                const isSelected = selectable && selectedKeys!.has(key);
                // Solid fills, not alpha: these also paint the sticky checkbox
                // cell, and content must not ghost through it while scrolling.
                const rowBg = isActive ? 'bg-brand-100' : isSelected ? 'bg-brand-50' : 'bg-white';
                const hoverBg = isActive || isSelected ? '' : 'group-hover/row:bg-slate-50';

                return (
                  <tr
                    key={key}
                    data-index={index}
                    tabIndex={index === Math.min(cursor, sorted.length - 1) ? 0 : -1}
                    aria-selected={selectable ? isSelected : undefined}
                    onClick={() => {
                      setCursor(index);
                      onRowClick?.(row);
                    }}
                    onDoubleClick={() => onRowDoubleClick?.(row)}
                    onFocus={() => setCursor(index)}
                    onKeyDown={(event) => onRowKeyDown(event, row, index)}
                    className={cx(
                      'group/row transition-colors',
                      rowBg,
                      hoverBg,
                      onRowClick && 'cursor-pointer',
                      isActive &&
                        '[&>td:first-child]:shadow-[inset_2px_0_0_0_var(--color-brand-700)]',
                      'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500',
                      rowClassName?.(row),
                    )}
                  >
                    {selectable && (
                      <td
                        onClick={(event) => event.stopPropagation()}
                        // mousedown lands before the checkbox change event, so
                        // this is where Shift is still observable.
                        onMouseDownCapture={(event) => {
                          shiftHeld.current = event.shiftKey;
                        }}
                        className={cx(
                          'border-b border-border/60 align-middle',
                          pad.cell,
                          rowBg,
                          hoverBg,
                          stickySelection && 'sticky left-0 z-10',
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          ariaLabel="Selectează rândul"
                          onChange={(checked) => {
                            toggleRow(index, checked, shiftHeld.current);
                            shiftHeld.current = false;
                          }}
                        />
                      </td>
                    )}

                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cx(
                          'border-b border-border/60 align-middle text-ink',
                          pad.cell,
                          alignClass(column),
                          column.wrap ? 'break-words' : 'truncate',
                          column.cellClassName,
                        )}
                      >
                        {renderCell(column, row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
