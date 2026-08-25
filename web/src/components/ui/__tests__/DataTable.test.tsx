/**
 * DataTable is the centrepiece of every screen in the app, and the one UI
 * component with real logic rather than styling: sorting, an empty state, a
 * loading skeleton and multi-select with a header tri-state checkbox.
 *
 * Tests are written against what a user sees and does (roles, text, clicks),
 * not against class names — the UI is actively being restyled, and a test that
 * breaks on a Tailwind change is worse than no test.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DataTable, type DataTableColumn } from '../DataTable';
import type { RowKey } from '../types';

interface Row {
  id: number;
  name: string;
  quantity: number | null;
}

const ROWS: Row[] = [
  { id: 1, name: 'Beta', quantity: 2 },
  { id: 2, name: 'Alpha', quantity: 10 },
  { id: 3, name: 'Gamma', quantity: null },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Nume', render: (row) => row.name, sortValue: (row) => row.name },
  {
    key: 'quantity',
    header: 'Cantitate',
    render: (row) => row.quantity ?? '—',
    sortValue: (row) => row.quantity,
    numeric: true,
  },
  // No sortValue: this column must NOT become clickable.
  { key: 'static', header: 'Static', render: () => 'x' },
];

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(
    <DataTable<Row>
      rows={ROWS}
      columns={COLUMNS}
      rowKey={(row) => row.id}
      ariaLabel="Tabel test"
      {...props}
    />,
  );
}

/** The clickable sort control inside a column header. */
function sortButton(header: string): HTMLElement {
  return within(screen.getByRole('columnheader', { name: new RegExp(header) })).getByRole('button');
}

/** Data row names in the order the DOM currently has them. */
function renderedNames(): string[] {
  const table = screen.getByRole('table');
  return within(table)
    .getAllByRole('row')
    .slice(1) // drop the header row
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');
}

describe('DataTable rendering', () => {
  it('renders one row per datum plus a header', () => {
    renderTable();

    expect(screen.getByRole('table', { name: 'Tabel test' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('renders every column header', () => {
    renderTable();
    for (const column of COLUMNS) {
      expect(screen.getByRole('columnheader', { name: new RegExp(column.header) }))
        .toBeInTheDocument();
    }
  });

  it('uses the column renderer, so a null cell shows the placeholder not "null"', () => {
    renderTable();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('shows the empty state instead of an empty grid when there are no rows', () => {
    renderTable({ rows: [], empty: <div>Nicio comandă</div> });

    expect(screen.getByText('Nicio comandă')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('does not show the empty state while loading with no data yet', () => {
    renderTable({ rows: [], loading: true, empty: <div>Nicio comandă</div> });

    expect(screen.queryByText('Nicio comandă')).not.toBeInTheDocument();
  });
});

describe('DataTable sorting', () => {
  it('sorts ascending on first click of a sortable header', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(sortButton('Nume'));

    expect(renderedNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('toggles to descending on the second click and clears on the third', async () => {
    const user = userEvent.setup();
    renderTable();
    const header = sortButton('Nume');

    await user.click(header);
    expect(renderedNames()).toEqual(['Alpha', 'Beta', 'Gamma']);

    await user.click(header);
    expect(renderedNames()).toEqual(['Gamma', 'Beta', 'Alpha']);

    // Third click returns to the caller's original order rather than sticking
    // on descending — "unsorted" is a real state.
    await user.click(header);
    expect(renderedNames()).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  /**
   * ⚠ COMMENT/CODE MISMATCH, pinned deliberately.
   *
   * `compareValues()` in components/ui/utils.ts genuinely sinks nulls: it
   * returns 1 whenever the left value is null, regardless of the right one.
   * But DataTable multiplies that result by the direction factor
   * (`result * factor`) before using it, which flips the null handling too —
   * so on a DESCENDING sort the empty cells float to the TOP, contradicting
   * the "Nulls sink to the bottom in both directions" comment right above that
   * line.
   *
   * Whether nulls-first is acceptable on a descending sort is a product call,
   * not a test call, so this asserts what the component does today. Fixing it
   * means comparing before applying the factor (or special-casing nulls
   * outside it) and then inverting the second half of this test.
   */
  it('sinks nulls on ascending, but floats them to the top on descending', async () => {
    const user = userEvent.setup();
    renderTable();
    const header = sortButton('Cantitate');

    await user.click(header); // ascending
    expect(renderedNames()).toEqual(['Beta', 'Alpha', 'Gamma']);

    await user.click(header); // descending
    expect(renderedNames()).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('honours initialSort without a click', () => {
    renderTable({ initialSort: { key: 'name', dir: 'desc' } });
    expect(renderedNames()).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('reports sort changes so a screen can persist them in the URL', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderTable({ onSortChange });

    await user.click(sortButton('Nume'));

    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', dir: 'asc' });
  });

  it('renders no sort control at all on a column with no sortValue', () => {
    renderTable();
    const header = screen.getByRole('columnheader', { name: /Static/ });

    // Not merely inert: an unsortable header must not look clickable.
    expect(within(header).queryByRole('button')).not.toBeInTheDocument();
    expect(renderedNames()).toEqual(['Beta', 'Alpha', 'Gamma']);
  });

  it('marks the sorted column with aria-sort for screen readers', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.getByRole('columnheader', { name: /Nume/ })).not.toHaveAttribute('aria-sort');

    await user.click(sortButton('Nume'));
    expect(screen.getByRole('columnheader', { name: /Nume/ }))
      .toHaveAttribute('aria-sort', 'ascending');

    await user.click(sortButton('Nume'));
    expect(screen.getByRole('columnheader', { name: /Nume/ }))
      .toHaveAttribute('aria-sort', 'descending');
  });
});

describe('DataTable row interaction', () => {
  it('calls onRowClick with the row datum', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderTable({ onRowClick });

    await user.click(screen.getByText('Alpha'));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });

  it('does not attach a click handler when the caller passes none', async () => {
    const user = userEvent.setup();
    renderTable();
    // Nothing to assert beyond "this does not throw" — a row without a handler
    // must stay inert rather than becoming a dead button.
    await user.click(screen.getByText('Alpha'));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
});

describe('DataTable selection', () => {
  /** Selection is controlled, so the test owns the state the way a page does. */
  function Controlled({ onChange }: { onChange?: (keys: Set<RowKey>) => void }) {
    const [selected, setSelected] = useState<Set<RowKey>>(new Set());
    return (
      <DataTable<Row>
        rows={ROWS}
        columns={COLUMNS}
        rowKey={(row) => row.id}
        ariaLabel="Tabel test"
        selectedKeys={selected}
        onSelectionChange={(keys) => {
          setSelected(keys);
          onChange?.(keys);
        }}
        bulkActions={<button type="button">Șterge selecția</button>}
      />
    );
  }

  it('shows no checkbox column unless both selection props are supplied', () => {
    renderTable();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('renders a checkbox per row plus one in the header', () => {
    render(<Controlled />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(ROWS.length + 1);
  });

  it('selecting a row reports exactly that row key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    const [, firstRowBox] = screen.getAllByRole('checkbox');
    await user.click(firstRowBox!);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect([...onChange.mock.calls[0]![0]]).toEqual([1]);
  });

  it('the header checkbox selects all, then clears all', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const [headerBox] = screen.getAllByRole('checkbox');

    await user.click(headerBox!);
    expect([...onChange.mock.calls.at(-1)![0]].sort()).toEqual([1, 2, 3]);

    await user.click(headerBox!);
    expect([...onChange.mock.calls.at(-1)![0]]).toEqual([]);
  });

  it('renders bulk actions only once something is selected', async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    expect(screen.queryByRole('button', { name: 'Șterge selecția' })).not.toBeInTheDocument();

    const [, firstRowBox] = screen.getAllByRole('checkbox');
    await user.click(firstRowBox!);

    expect(screen.getByRole('button', { name: 'Șterge selecția' })).toBeInTheDocument();
  });
});
