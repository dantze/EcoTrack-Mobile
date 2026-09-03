/**
 * DataTable — the message list of this app, not a widget on a page.
 *
 * Built on the shadcn table parts (`TableHeader/Body/Row/Head/Cell`) but it
 * owns the `<table>` element and the scroll container itself: shadcn's `Table`
 * wraps its table in an `overflow-x-auto` div, and that div becomes the nearest
 * scrollport — which pins `sticky top-0` to the top of the table instead of the
 * top of the viewport, and hides the real scroll element from
 * `@tanstack/react-virtual`. Sticky headers and virtualisation both need the
 * scrollport to be ours.
 *
 * Layout notes that matter for a back-office grid:
 *
 * - `border-separate` (not `collapse`) so sticky header cells keep their
 *   hairline while the body scrolls under them.
 * - `table-fixed` + a `<colgroup>`: columns keep the width the caller asked
 *   for, cells truncate instead of pushing the layout around, and columns
 *   without a width share the remainder like `1fr`.
 * - Vertical scrolling only. A sideways-sliding table hides columns behind an
 *   edge the user has no reason to expect; on the dispatch board it made the
 *   route list feel like a carousel. Drop a column rather than reintroducing
 *   `overflow-x`.
 * - Loading renders skeleton rows in the real column geometry, so nothing
 *   jumps when data lands.
 *
 * Interaction, in Outlook's dialect:
 *   click        open the row (`onRowClick`)
 *   ⌘/Ctrl-click toggle that row's selection, without opening it
 *   shift-click  extend the selection from the last row touched
 *   ↑ ↓ Home End move the row cursor · Enter opens · Space selects · ⌘A all
 *
 * The table is a single tab stop: exactly one row carries `tabIndex=0` and the
 * arrows move it. The cursor index is **clamped where it is read**, never
 * corrected in an effect — the list shrinks during render, and an effect fixes
 * it one render too late, by which point Enter has already committed nothing
 * (TODO-26).
 *
 * Below `md` none of that applies: the table is replaced by a card list, since
 * eight columns at 390px is a horizontal scrollbar with extra steps. A card is
 * one button (open the row) plus, beside it, the columns named by
 * `mobile.actions` — controls have to live OUTSIDE that button, and every
 * screen with an action column must say which one it is or accept the
 * unheadered-last-column guess.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDownUp, Trash2 } from 'lucide-react';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table';
import { Button } from '@/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu';
import { Skeleton } from '@/components/shadcn/skeleton';
import { cn } from '@/lib/utils';
import { Checkbox } from './Checkbox';
import { EmptyState } from './EmptyState';
import { SortIcon } from './icons';
import { compareValues } from './utils';
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

/**
 * Which columns survive the collapse to a card. Keys refer to `columns`;
 * anything unknown is ignored, so a stale key degrades to the fallback rather
 * than blanking a line.
 */
export interface DataTableMobileConfig {
  /** Line one, bold — the thing the row is called. */
  primary: string;
  /** Line two, muted, joined with a middot. Two keys is the readable limit. */
  secondary?: string[];
  /** Right-aligned on line one: status, amount, date. */
  trailing?: string;
  /**
   * The row's controls. Rendered NEXT TO the card's open-the-row button, not
   * inside it — a column whose cell is a Button or a Select cannot go in
   * `primary`/`secondary`/`trailing`, because those live inside that button
   * and nesting interactive elements is invalid markup that swallows the tap.
   *
   * A list, because a screen may spread its controls over more than one column
   * (Angajați has the role Select and the delete button in two).
   */
  actions?: string | string[];
}

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
  /** Steers the sub-`md` card list. Optional: the fallback reads the columns. */
  mobile?: DataTableMobileConfig;
  className?: string;
}

const DENSITY = {
  compact: { row: 'h-7', cell: 'px-2.5 py-0', head: 'h-8 px-2.5', px: 28 },
  comfortable: { row: 'h-9', cell: 'px-3 py-0', head: 'h-9 px-3', px: 36 },
} as const;

const SELECT_COL_WIDTH = '2.25rem';

/**
 * Above this many rows the DOM cost of a full render starts to show on a
 * mid-range laptop. Below it, virtualising is a straight loss: it breaks
 * find-in-page and Ctrl+End, for no gain nobody can measure.
 */
const VIRTUALIZE_ABOVE = 100;

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
  mobile,
  className,
}: DataTableExtendedProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [cursor, setCursor] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const lastToggledIndex = useRef<number | null>(null);
  const shiftHeld = useRef(false);
  /** Set when a row that should take focus is not in the DOM yet (virtualised). */
  const pendingFocus = useRef<number | null>(null);

  // `undefined` on the first render and in jsdom; the desktop table is the
  // safe default — a phone shows a table for one frame, a desktop never shows
  // the card list.
  const isMobile = useMediaQuery('(max-width: 767px)') ?? false;
  const cardIdBase = useId();

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

  const sortableColumns = useMemo(() => columns.filter((column) => column.sortValue), [columns]);

  // Clamped on read, in both places that consume it. See the file header.
  const cursorIndex = sorted.length === 0 ? 0 : Math.min(Math.max(cursor, 0), sorted.length - 1);

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

  // ---- virtualisation -----------------------------------------------------

  const virtualised = sorted.length > VIRTUALIZE_ABOVE;
  const virtualizer = useVirtualizer({
    // A zero count keeps the hook inert below the threshold without making the
    // hook itself conditional.
    count: virtualised ? sorted.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => pad.px,
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1]!.end : 0;

  /** The rows actually rendered, paired with their index in `sorted`. */
  const visible = useMemo(() => {
    if (!virtualised) return sorted.map((row, index) => ({ row, index }));
    return virtualItems
      .filter((item) => sorted[item.index] !== undefined)
      .map((item) => ({ row: sorted[item.index]!, index: item.index }));
  }, [virtualised, sorted, virtualItems]);

  const cursorRendered = visible.some((entry) => entry.index === cursorIndex);

  // ---- selection ----------------------------------------------------------

  const isSelected = (row: T) => Boolean(selectedKeys?.has(rowKey(row)));
  const selectedCount = selectedKeys?.size ?? 0;
  const allSelected = selectable && sorted.length > 0 && sorted.every(isSelected);
  const someSelected = selectable && sorted.some(isSelected);

  const toggleAll = (checked: boolean) => {
    onSelectionChange!(checked ? new Set(sorted.map(rowKey)) : new Set<RowKey>());
    lastToggledIndex.current = null;
  };

  const toggleRow = (index: number, checked: boolean, extendRange = false) => {
    const next = new Set(selectedKeys!);
    const from = extendRange && lastToggledIndex.current !== null ? lastToggledIndex.current : index;
    const [start, end] = from <= index ? [from, index] : [index, from];

    for (let at = start; at <= end; at += 1) {
      const row = sorted[at];
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
      if (sorted.length === 0) return;
      const clamped = Math.max(0, Math.min(index, sorted.length - 1));
      setCursor(clamped);
      if (virtualised) virtualizer.scrollToIndex(clamped, { align: 'auto' });

      const element = bodyRef.current?.querySelector<HTMLTableRowElement>(
        `tr[data-index="${clamped}"]`,
      );
      if (element) {
        element.focus({ preventScroll: true });
        element.scrollIntoView({ block: 'nearest' });
        pendingFocus.current = null;
      } else {
        // Virtualised and off-screen: the row does not exist yet. The effect
        // below finishes the move once the virtualiser has rendered it.
        pendingFocus.current = clamped;
      }
    },
    [sorted.length, virtualised, virtualizer],
  );

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    const element = bodyRef.current?.querySelector<HTMLTableRowElement>(`tr[data-index="${target}"]`);
    if (!element) return;
    element.focus({ preventScroll: true });
    pendingFocus.current = null;
  });

  const onRowKeyDown = (event: React.KeyboardEvent, row: T, index: number) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      if (!selectable) return;
      event.preventDefault();
      toggleAll(true);
      return;
    }

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
          toggleRow(index, !isSelected(row));
        }
        break;
      default:
        break;
    }
  };

  /** Outlook's three-way click: plain opens, ⌘ toggles one, shift extends. */
  const onRowMouseDownSelect = (event: React.MouseEvent, row: T, index: number): boolean => {
    if (!selectable) return false;
    if (event.shiftKey) {
      toggleRow(index, true, true);
      return true;
    }
    if (event.metaKey || event.ctrlKey) {
      toggleRow(index, !isSelected(row));
      return true;
    }
    return false;
  };

  // ---- cells --------------------------------------------------------------

  const alignClass = (column: DataTableColumn<T>) => {
    const align = column.align ?? (column.numeric ? 'right' : 'left');
    return cn(
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
  const showEmpty = !showSkeleton && sorted.length === 0;

  // ---- chrome shared by both renderings -----------------------------------

  const bulkBar = selectable && selectedCount > 0 && (
    <div
      className={cn(
        'flex shrink-0 animate-slide-up items-center gap-3 border-b border-border',
        'bg-surface-active px-3 py-1.5',
      )}
    >
      <span className="tabular text-sm font-medium text-ink">
        {selectedCount} {selectedCount === 1 ? 'selectat' : 'selectate'}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onSelectionChange!(new Set<RowKey>())}
        className="text-ink-muted"
      >
        Deselectează
      </Button>
      {bulkActions && (
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="xs">
                  <Trash2 />
                  Acțiuni
                </Button>
              </DropdownMenuTrigger>
              {/* The caller's buttons keep working inside the menu; wrapping
                  them beats letting four of them wrap onto three rows. */}
              <DropdownMenuContent align="end" className="flex flex-col gap-1 p-1.5">
                {bulkActions}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            bulkActions
          )}
        </div>
      )}
    </div>
  );

  const loadingHairline = loading && rows.length > 0 && (
    // Refetch over existing rows: a hairline instead of blanking the table.
    <div className="absolute inset-x-0 top-0 z-30 h-0.5 animate-pulse bg-primary/60" aria-hidden />
  );

  // ---- mobile: a card list, not a squeezed table --------------------------

  if (isMobile) {
    const byKey = new Map(columns.map((column) => [column.key, column]));
    const pick = (key?: string) => (key ? byKey.get(key) : undefined);

    const primary = pick(mobile?.primary) ?? columns[0];

    /**
     * An unheadered trailing column is a control column by this app's own
     * convention — `{ key: 'actions', header: '' }` on five screens — and the
     * fallback used to hand it to `trailing`, i.e. into the row button. So a
     * phone got Șterge / Editează / a role Select nested inside the control
     * that opens the record. Unlabelled last column means actions unless the
     * caller says otherwise.
     */
    const lastColumn = columns.length > 1 ? columns[columns.length - 1] : undefined;
    const fallbackActions =
      lastColumn && !lastColumn.header && lastColumn !== primary ? lastColumn : undefined;

    const declaredActions =
      mobile?.actions === undefined
        ? undefined
        : (Array.isArray(mobile.actions) ? mobile.actions : [mobile.actions])
            .map(pick)
            .filter((column): column is DataTableColumn<T> => Boolean(column));
    const actions =
      declaredActions ?? (mobile ? [] : fallbackActions ? [fallbackActions] : []);
    const isAction = (column: DataTableColumn<T>) => actions.includes(column);

    const trailing =
      pick(mobile?.trailing) ??
      (mobile
        ? undefined
        : columns.length > 3
          ? columns.filter((column) => column !== primary && !isAction(column)).at(-1)
          : undefined);
    const secondary = (
      mobile?.secondary
        ? mobile.secondary.map(pick).filter((column): column is DataTableColumn<T> => Boolean(column))
        : columns
            .filter((column) => column !== primary && column !== trailing && !isAction(column))
            .slice(0, 2)
    ).slice(0, 2);

    return (
      <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col', className)}>
        {bulkBar}
        {loadingHairline}

        {sortableColumns.length > 0 && !showEmpty && (
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-header px-3 py-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="xs" className="text-ink-muted">
                  <ArrowDownUp />
                  {sort
                    ? (byKey.get(sort.key)?.header ?? 'Sortare')
                    : 'Sortează'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Sortează după</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sortableColumns.map((column) => (
                  <DropdownMenuItem key={column.key} onSelect={() => applySort(column)}>
                    {column.header}
                    {sort?.key === column.key && (
                      <span className="ml-auto text-ink-muted">
                        {sort.dir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {selectable && sorted.length > 0 && (
              <Checkbox
                checked={Boolean(allSelected)}
                indeterminate={Boolean(someSelected)}
                onChange={toggleAll}
                ariaLabel="Selectează toate rândurile"
                className="ml-auto"
                label={<span className="text-xs text-ink-muted">Toate</span>}
              />
            )}
          </div>
        )}

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          {showSkeleton && (
            <ul className="divide-y divide-border">
              {Array.from({ length: skeletonRows }).map((_, index) => (
                <li key={`skeleton-${index}`} className="flex min-h-11 flex-col justify-center gap-1.5 px-3 py-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2.5 w-3/4" />
                </li>
              ))}
            </ul>
          )}

          {showEmpty &&
            (empty ?? (
              <EmptyState
                size="sm"
                title="Niciun rezultat"
                body="Ajustează filtrele sau caută altceva."
              />
            ))}

          {!showSkeleton && !showEmpty && (
            <ul className="divide-y divide-border">
              {sorted.map((row, index) => {
                const key = rowKey(row);
                const active = activeKey === key;
                const checked = selectable && isSelected(row);
                return (
                  <li
                    key={key}
                    className={cn(
                      'relative flex min-h-11 w-full items-center gap-2 px-3',
                      active ? 'bg-surface-active' : checked ? 'bg-surface-hover' : 'bg-surface',
                      active && 'shadow-[inset_2px_0_0_0_var(--primary)]',
                      rowClassName?.(row),
                    )}
                  >
                    {selectable && (
                      <span className="relative">
                        <Checkbox
                          checked={checked}
                          onChange={(next) => toggleRow(index, next)}
                          ariaLabel="Selectează rândul"
                        />
                      </span>
                    )}
                    {/* The open-the-row control is a stretched button UNDER the
                        content, not a wrapper around it. A cell is free to
                        render a control — Produse swaps its name, description
                        and price cells for inputs while a row is being edited —
                        and a control nested inside a button is invalid markup
                        that swallows the tap. It takes its accessible name from
                        the primary cell, so rows still announce themselves. */}
                    {onRowClick && (
                      <button
                        type="button"
                        onClick={() => onRowClick(row)}
                        aria-labelledby={`${cardIdBase}-${key}-primary`}
                        className={cn(
                          'absolute inset-0 rounded-md',
                          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                        )}
                      />
                    )}
                    {/* Inert to taps so they reach the button beneath, except
                        for anything a cell rendered that is itself a control. */}
                    <span
                      className={cn(
                        'pointer-events-none relative flex min-w-0 flex-1 items-center gap-3 py-2 text-left',
                        '[&_a]:pointer-events-auto [&_button]:pointer-events-auto',
                        '[&_input]:pointer-events-auto [&_select]:pointer-events-auto',
                        '[&_textarea]:pointer-events-auto [&_[role=combobox]]:pointer-events-auto',
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          id={`${cardIdBase}-${key}-primary`}
                          className="clamp-1 text-sm font-semibold text-ink"
                        >
                          {primary ? renderCell(primary, row) : null}
                        </span>
                        {secondary.length > 0 && (
                          <span className="clamp-1 flex items-center gap-1.5 text-xs text-ink-muted">
                            {secondary.map((column, position) => (
                              <span key={column.key} className="flex min-w-0 items-center gap-1.5">
                                {position > 0 && <span aria-hidden>·</span>}
                                <span className="truncate">{renderCell(column, row)}</span>
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      {trailing && (
                        <span className="tabular shrink-0 text-xs text-ink-muted">
                          {renderCell(trailing, row)}
                        </span>
                      )}
                    </span>
                    {actions.length > 0 && (
                      <span className="relative flex shrink-0 items-center gap-1">
                        {actions.map((column) => (
                          <span key={column.key}>{renderCell(column, row)}</span>
                        ))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ---- desktop: the table -------------------------------------------------

  const renderRow = (row: T, index: number) => {
    const key = rowKey(row);
    const active = activeKey === key;
    const checked = selectable && isSelected(row);
    // Solid fills, not alpha: these also paint the sticky checkbox cell, and
    // content must not ghost through it while scrolling sideways.
    const rowBg = active ? 'bg-surface-active' : checked ? 'bg-surface-hover' : 'bg-surface';
    const hoverBg = active || checked ? '' : 'group-hover/row:bg-surface-hover';

    return (
      <TableRow
        key={key}
        data-index={index}
        tabIndex={index === cursorIndex ? 0 : -1}
        aria-selected={selectable ? checked : undefined}
        data-state={checked ? 'selected' : undefined}
        onClick={(event) => {
          setCursor(index);
          if (onRowMouseDownSelect(event, row, index)) return;
          onRowClick?.(row);
        }}
        onDoubleClick={() => onRowDoubleClick?.(row)}
        onFocus={() => setCursor(index)}
        onKeyDown={(event) => onRowKeyDown(event, row, index)}
        className={cn(
          'group/row border-0 transition-colors',
          pad.row,
          rowBg,
          hoverBg,
          selectable && 'select-none',
          onRowClick && 'cursor-pointer',
          active && '[&>td:first-child]:shadow-[inset_2px_0_0_0_var(--primary)]',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          rowClassName?.(row),
        )}
      >
        {selectable && (
          <TableCell
            onClick={(event) => event.stopPropagation()}
            // mousedown lands before the checkbox change event, so this is
            // where Shift is still observable.
            onMouseDownCapture={(event) => {
              shiftHeld.current = event.shiftKey;
            }}
            className={cn(
              'border-b border-border align-middle',
              pad.cell,
              rowBg,
              hoverBg,
              stickySelection && 'sticky left-0 z-10',
            )}
          >
            <Checkbox
              checked={checked}
              ariaLabel="Selectează rândul"
              onChange={(next) => {
                toggleRow(index, next, shiftHeld.current);
                shiftHeld.current = false;
              }}
            />
          </TableCell>
        )}

        {columns.map((column) => (
          <TableCell
            key={column.key}
            className={cn(
              'border-b border-border align-middle text-sm text-ink',
              pad.cell,
              alignClass(column),
              column.wrap ? 'break-words whitespace-normal' : 'truncate',
              column.cellClassName,
            )}
          >
            {renderCell(column, row)}
          </TableCell>
        ))}
      </TableRow>
    );
  };

  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      {bulkBar}
      {loadingHairline}

      <div
        ref={scrollRef}
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
        // Virtualised lists can scroll the cursor row out of the DOM, taking
        // the table's only tab stop with it. The container then becomes the
        // tab stop and hands focus straight back to the cursor row.
        tabIndex={virtualised && !cursorRendered && sorted.length > 0 ? 0 : -1}
        onFocus={(event) => {
          if (event.target === event.currentTarget) focusRow(cursorIndex);
        }}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain outline-none"
      >
        <table
          data-slot="table"
          className="w-full border-separate border-spacing-0 text-left text-sm"
          style={{ tableLayout: 'fixed' }}
          aria-busy={loading || undefined}
          aria-label={ariaLabel}
        >
          <colgroup>
            {selectable && <col style={{ width: SELECT_COL_WIDTH }} />}
            {columns.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>

          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              {selectable && (
                <TableHead
                  scope="col"
                  className={cn(
                    'border-b border-border bg-surface-header',
                    pad.head,
                    stickyHeader && 'sticky top-0 z-30',
                    stickyHeader && scrolled && 'shadow-sticky',
                    stickySelection && 'sticky left-0',
                  )}
                >
                  <Checkbox
                    checked={Boolean(allSelected)}
                    indeterminate={Boolean(someSelected)}
                    onChange={toggleAll}
                    ariaLabel="Selectează toate rândurile"
                  />
                </TableHead>
              )}

              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                return (
                  <TableHead
                    key={column.key}
                    scope="col"
                    title={column.headerTitle}
                    aria-sort={
                      isSorted ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'group/th border-b border-border bg-surface-header font-semibold',
                      'text-[0.6875rem] tracking-wide whitespace-nowrap uppercase',
                      isSorted ? 'text-ink' : 'text-ink-muted',
                      pad.head,
                      alignClass(column),
                      stickyHeader && 'sticky top-0 z-20',
                      stickyHeader && scrolled && 'shadow-sticky',
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => applySort(column)}
                        className={cn(
                          'inline-flex max-w-full items-center gap-1 rounded-sm transition-colors hover:text-ink',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          (column.align === 'right' || column.numeric) && 'flex-row-reverse',
                        )}
                      >
                        <span className="truncate">{column.header}</span>
                        <SortIcon direction={isSorted ? sort!.dir : undefined} />
                      </button>
                    ) : (
                      <span className="block truncate">{column.header}</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody ref={bodyRef} className="[&_tr:last-child]:border-0">
            {showSkeleton &&
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className={cn('border-0 bg-surface', pad.row)}>
                  {selectable && (
                    <TableCell className={cn('border-b border-border', pad.cell)}>
                      <Skeleton className="size-4 rounded-[0.25rem]" />
                    </TableCell>
                  )}
                  {columns.map((column, columnIndex) => (
                    <TableCell key={column.key} className={cn('border-b border-border', pad.cell)}>
                      <Skeleton
                        className="h-3"
                        style={{
                          // Deterministic ragged widths read as text, not as bars.
                          width: `${[70, 45, 60, 85, 55][(rowIndex + columnIndex) % 5]}%`,
                          animationDelay: `${rowIndex * 60}ms`,
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {showEmpty && (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={columnCount} className="bg-surface p-0 whitespace-normal">
                  {empty ?? (
                    <EmptyState
                      size="sm"
                      title="Niciun rezultat"
                      body="Ajustează filtrele sau caută altceva."
                    />
                  )}
                </TableCell>
              </TableRow>
            )}

            {/* Spacer rows stand in for the rows the virtualiser skipped, so
                the scrollbar and the sticky header behave as if all of them
                were there. */}
            {virtualised && paddingTop > 0 && (
              <tr aria-hidden style={{ height: paddingTop }}>
                <td colSpan={columnCount} />
              </tr>
            )}

            {!showSkeleton && !showEmpty && visible.map(({ row, index }) => renderRow(row, index))}

            {virtualised && paddingBottom > 0 && (
              <tr aria-hidden style={{ height: paddingBottom }}>
                <td colSpan={columnCount} />
              </tr>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
