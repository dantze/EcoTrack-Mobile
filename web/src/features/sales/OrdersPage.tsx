/**
 * Comenzi — the main Sales screen.
 *
 * Outlook's shape: a ribbon (`CommandBar`) over a list, and the selected
 * record in a reading pane beside it. Clicking a row never leaves the list —
 * on `lg+` the order opens in the right pane, below that in a Sheet — so the
 * scroll position, the filters and the selection all survive reading a record.
 * Only the create/edit FORM is still a slide-over, because it is a mode: you
 * are editing, not browsing.
 *
 * **Two views, one table (TODO-21).** `Curente` holds the work still to do and
 * `Arhivă` the orders that are finished, split by `isOrderFulfilled` in
 * `./orderModel` — a COMPLETED task and nothing else, the same rule the backend
 * uses to decide which orders block retiring a subscription (TODO-20). The
 * split is DERIVED, not stored: there is no archive flag to keep in sync, and
 * nothing to press. An order leaves Arhivă exactly when its task stops being
 * COMPLETED (a driver reopening it), which is the only thing that could
 * honestly un-archive it. Archived orders are not read-only either — the drawer
 * still edits and deletes, because correcting a typo on finished work is
 * ordinary, and a lock nobody asked for would be a new permission concept.
 *
 * The two derivations behind the table — what the filter strip lets through,
 * and which half each survivor lands in — are pure functions in
 * `./orderFilters`, so they can be read and tested without rendering a screen
 * this long.
 *
 * Two entry points besides clicking a row: `?comanda=<id>` opens that order's
 * drawer and `?nou=1` opens an empty form, which is how the command palette
 * (⌘K) reaches this screen and what makes an order link shareable. A deep link
 * to a finished order switches to Arhivă, so the row behind the drawer is the
 * one the link named.
 */

import { useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { CommandBar, ListDetail, ToolbarSeparator, Workbench } from '@/components/layout';
import {
  Badge,
  Button,
  DataTable,
  DateInput,
  EmptyState,
  Select,
  Skeleton,
  Tabs,
  useConfirm,
  type Column,
  type RowKey,
  type SelectOption,
} from '@/components/ui';
import {
  ClientCell,
  ORDER_TYPE_LABELS,
  OrderTypeBadge,
  TaskStatusBadge,
} from '@/components/domain';
import { ORDER_TYPES, type Order, clientName } from '@/types/domain';
import { useDeepLink, useDeepLinkOnce, useDeepLinkFlagOnce } from '@/lib/deepLink';
import { useShortcuts } from '@/lib/hotkeys';
import { recordUse } from '@/lib/recents';
import { ErrorNotice, FilterBar, FilterField, SearchInput } from './components/FilterBar';
import { OrderDetailPane } from './components/OrderDetailDrawer';
import { OrderFormDrawer } from './components/OrderFormDrawer';
import { errorMessage, toast } from './components/Toaster';
import {
  filterOrders,
  hasActiveFilters,
  splitByFulfilment,
  type OrderFilters,
} from './orderFilters';
import {
  isOrderFulfilled,
  orderAddress,
  orderDateLabel,
  orderPrimaryDate,
  orderSummary,
} from './orderModel';
import { useClients, useDeleteOrders, useOrderTaskStatuses, useOrders } from './queries';

const TYPE_OPTIONS: SelectOption<string>[] = [
  { value: '', label: 'Toate tipurile' },
  ...ORDER_TYPES.map((type) => ({ value: type, label: ORDER_TYPE_LABELS[type] })),
];

/** Which half of the split the table is showing. */
type View = 'current' | 'archive';

const VIEW_LABELS: Record<View, string> = {
  current: 'Curente',
  archive: 'Arhivă',
};

type DrawerState =
  | { kind: 'none' }
  | { kind: 'detail'; orderId: number }
  | { kind: 'create' }
  | { kind: 'edit'; orderId: number };

export function OrdersPage() {
  const ordersQuery = useOrders();
  const clientsQuery = useClients();
  const deleteOrders = useDeleteOrders();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [view, setView] = useState<View>('current');
  const [selected, setSelected] = useState<Set<RowKey>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>({ kind: 'none' });
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  // ── Deep links from the command palette and from shared URLs ────────────
  useDeepLinkOnce('comanda', useDeepLink().number('comanda'), (orderId) => {
    setDrawer({ kind: 'detail', orderId });
    recordUse('order', orderId);
  });

  useDeepLinkFlagOnce('nou', () => setDrawer({ kind: 'create' }));

  const openDetail = (orderId: number) => {
    recordUse('order', orderId);
    setDrawer({ kind: 'detail', orderId });
  };

  useShortcuts([
    {
      combo: 'n',
      description: 'Comandă nouă',
      group: 'Comenzi',
      run: () => setDrawer({ kind: 'create' }),
    },
    {
      combo: '/',
      description: 'Focus pe câmpul de căutare',
      group: 'Comenzi',
      run: () => searchRef.current?.focus(),
    },
    {
      combo: 'r',
      description: 'Reîmprospătează lista',
      group: 'Comenzi',
      run: () => void ordersQuery.refetch(),
    },
  ]);

  const statusesQuery = useOrderTaskStatuses(orders.map((order) => order.id));

  const clientOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: '', label: 'Toți clienții' },
      ...(clientsQuery.data ?? [])
        .map((client) => ({ value: String(client.id), label: clientName(client) }))
        .sort((left, right) => left.label.localeCompare(right.label, 'ro')),
    ],
    [clientsQuery.data],
  );

  const taskStatuses = statusesQuery.data;

  // Which rows the table shows: the filter strip narrows, then the tab picks a
  // half. Both derivations live in `./orderFilters` — see that file for why the
  // Curente/Arhivă split is computed rather than stored.
  const filters = useMemo<OrderFilters>(
    () => ({
      search,
      type: typeFilter,
      clientId: clientFilter,
      from: dateFrom,
      to: dateTo,
    }),
    [search, typeFilter, clientFilter, dateFrom, dateTo],
  );

  const matching = useMemo(() => filterOrders(orders, filters), [orders, filters]);
  const { current, archived } = useMemo(
    () => splitByFulfilment(matching, taskStatuses),
    [matching, taskStatuses],
  );
  const rows = view === 'archive' ? archived : current;

  const showView = (next: View) => {
    if (next === view) return;
    setView(next);
    // A selection made in one view must not be carried into a bulk delete in
    // the other, where its rows are not even on screen.
    setSelected(new Set());
  };

  const filtersActive = hasActiveFilters(filters);

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('');
    setClientFilter('');
    setDateFrom(null);
    setDateTo(null);
  };

  const openOrder = drawer.kind === 'detail' || drawer.kind === 'edit'
    ? orders.find((order) => order.id === drawer.orderId) ?? null
    : null;

  // A link (or the command palette) can name a finished order while the table
  // is on Curente. Follow the order rather than opening a drawer over a list
  // that does not contain its row.
  const openOrderIsArchived = openOrder !== null && isOrderFulfilled(taskStatuses?.[openOrder.id]);

  // Adjusted DURING RENDER rather than in an effect (TODO-26), which is React's
  // own answer for "one piece of state has to follow another"
  // (react.dev/learn/you-might-not-need-an-effect). The tab lands correct on the
  // first paint instead of showing the wrong list for a frame, and `view` stays
  // ordinary state that the tabs themselves still write.
  //
  // The key is the ORDER PLUS its archived-ness, not the order alone: the task
  // status arrives from its own query afterwards, so an order opens looking
  // current and turns out to be archived a moment later — and that late answer
  // has to move the tab too.
  const followKey = openOrder ? `${openOrder.id}:${openOrderIsArchived}` : null;
  const [followedKey, setFollowedKey] = useState<string | null>(null);
  if (followKey !== null && followKey !== followedKey) {
    setFollowedKey(followKey);
    setView(openOrderIsArchived ? 'archive' : 'current');
  }

  const removeOrders = async (ids: number[], label: string) => {
    const confirmed = await confirm({
      title: ids.length > 1 ? `Șterge ${ids.length} comenzi?` : 'Șterge comanda?',
      body: `${label} Această acțiune nu poate fi anulată.`,
      confirmLabel: 'Șterge',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteOrders.mutateAsync(ids);
      setSelected(new Set());
      setDrawer({ kind: 'none' });
      toast.success(ids.length > 1 ? 'Comenzile au fost șterse.' : 'Comanda a fost ștearsă.');
    } catch (error) {
      toast.error(errorMessage(error, 'Nu s-a putut șterge comanda'));
    }
  };

  const columns: Column<Order>[] = [
    {
      key: 'number',
      header: 'Nr.',
      width: '5rem',
      align: 'right',
      sortValue: (order) => order.number,
      render: (order) => <span className="tabular font-medium">#{order.number}</span>,
    },
    {
      key: 'date',
      header: 'Dată',
      width: '12rem',
      sortValue: (order) => orderPrimaryDate(order),
      render: (order) => <span className="whitespace-nowrap">{orderDateLabel(order)}</span>,
    },
    {
      key: 'client',
      header: 'Client',
      width: '16rem',
      sortValue: (order) => clientName(order.client).toLowerCase(),
      render: (order) => <ClientCell client={order.client} />,
    },
    {
      key: 'type',
      header: 'Tip',
      width: '8rem',
      sortValue: (order) => order.orderType,
      render: (order) => <OrderTypeBadge type={order.orderType} />,
    },
    {
      key: 'summary',
      header: 'Comandă',
      width: '14rem',
      sortValue: (order) => orderSummary(order).toLowerCase(),
      render: (order) => <span className="truncate">{orderSummary(order)}</span>,
    },
    {
      key: 'address',
      header: 'Adresă',
      sortValue: (order) => (orderAddress(order) ?? '').toLowerCase(),
      render: (order) => (
        <span className="block max-w-[24rem] truncate text-ink-muted">
          {orderAddress(order) ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '8rem',
      sortValue: (order) => statusesQuery.data?.[order.id] ?? 'ZZZ',
      render: (order) => {
        const status = statusesQuery.data?.[order.id] ?? null;
        if (status) return <TaskStatusBadge status={status} />;
        if (statusesQuery.isLoading) return <Skeleton className="h-4 w-20 rounded-full" />;
        return <Badge tone="danger">Neprogramat</Badge>;
      },
    },
  ];

  const emptyState =
    view === 'archive' ? (
      <EmptyState
        title={
          filtersActive ? 'Nicio comandă finalizată pentru filtrele curente' : 'Arhiva este goală'
        }
        body={
          filtersActive
            ? 'Modificați filtrele sau resetați-le.'
            : 'O comandă ajunge aici când sarcina ei este marcată finalizată.'
        }
        action={
          filtersActive ? (
            <Button variant="secondary" onClick={resetFilters}>
              Resetează filtrele
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => showView('current')}>
              Vezi comenzile curente
            </Button>
          )
        }
      />
    ) : (
      <EmptyState
        title={filtersActive ? 'Nicio comandă pentru filtrele curente' : 'Nu există comenzi'}
        body={
          filtersActive
            ? 'Modificați filtrele sau resetați-le.'
            : archived.length > 0
              ? 'Toate comenzile sunt finalizate — sunt în Arhivă.'
              : 'Creați prima comandă pentru un client existent.'
        }
        action={
          filtersActive ? (
            <Button variant="secondary" onClick={resetFilters}>
              Resetează filtrele
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setDrawer({ kind: 'create' })}>
              + Comandă
            </Button>
          )
        }
      />
    );

  const list = ordersQuery.isError ? (
    <ErrorNotice
      message="Nu s-au putut prelua comenzile."
      onRetry={() => void ordersQuery.refetch()}
    />
  ) : (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(order) => order.id}
      ariaLabel={view === 'archive' ? 'Comenzi finalizate' : 'Comenzi curente'}
      initialSort={{ key: 'date', dir: 'desc' }}
      loading={ordersQuery.isLoading}
      activeKey={openOrder?.id ?? null}
      onRowClick={(order) => openDetail(order.id)}
      selectedKeys={selected}
      onSelectionChange={setSelected}
      mobile={{ primary: 'client', secondary: ['summary', 'address'], trailing: 'status' }}
      bulkActions={
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 aria-hidden />}
          loading={deleteOrders.isPending}
          onClick={() =>
            void removeOrders(
              [...selected].map(Number),
              `${selected.size} comenzi vor fi șterse definitiv.`,
            )
          }
        >
          Șterge selecția
        </Button>
      }
      empty={emptyState}
    />
  );

  return (
    <Workbench>
      <CommandBar
        title="Comenzi"
        subtitle={
          ordersQuery.isLoading
            ? 'Se încarcă…'
            : `${rows.length} ${view === 'archive' ? 'comenzi finalizate' : 'comenzi curente'}` +
              ` din ${orders.length} în total${filtersActive ? ' (filtrate)' : ''}`
        }
        tools={
          <>
            <div className="hidden w-56 md:block xl:w-72">
              <SearchInput
                inputRef={searchRef}
                value={search}
                onChange={setSearch}
                placeholder="Număr, client, adresă…"
              />
            </div>
            <Button
              variant={showFilters ? 'secondary' : 'ghost'}
              size="sm"
              icon={<SlidersHorizontal aria-hidden />}
              aria-expanded={showFilters}
              onClick={() => setShowFilters((open) => !open)}
            >
              <span className="hidden sm:inline">Filtre</span>
              {filtersActive && (
                <span
                  aria-label="filtre active"
                  className="ml-1 size-1.5 rounded-full bg-primary"
                />
              )}
            </Button>
          </>
        }
        actions={
          <>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus aria-hidden />}
              onClick={() => setDrawer({ kind: 'create' })}
            >
              Comandă nouă
            </Button>
            <ToolbarSeparator />
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw aria-hidden />}
              onClick={() => void ordersQuery.refetch()}
              loading={ordersQuery.isFetching}
            >
              Reîmprospătează
            </Button>
            {selected.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 aria-hidden />}
                loading={deleteOrders.isPending}
                onClick={() =>
                  void removeOrders(
                    [...selected].map(Number),
                    `${selected.size} comenzi vor fi șterse definitiv.`,
                  )
                }
              >
                Șterge {selected.size}
              </Button>
            )}
          </>
        }
        tabs={
          <Tabs
            items={[
              { id: 'current', label: VIEW_LABELS.current, count: current.length },
              { id: 'archive', label: VIEW_LABELS.archive, count: archived.length },
            ]}
            active={view}
            onChange={(id) => showView(id as View)}
          />
        }
      />

      {/* The filter strip is opt-in. On a laptop it costs 56px of list every
          time it is left open, and four filters out of five are set once a
          week — so it opens on demand and announces itself in the ribbon with
          a dot when something is actually filtering. */}
      {showFilters && (
        <FilterBar>
          <FilterField label="Căutare">
            <div className="md:hidden">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Număr, client, adresă"
              />
            </div>
          </FilterField>
          <FilterField label="Tip">
            <div className="w-40">
              <Select value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} size="sm" />
            </div>
          </FilterField>
          <FilterField label="Client">
            <div className="w-56">
              <Select
                value={clientFilter}
                options={clientOptions}
                onChange={setClientFilter}
                searchable
                size="sm"
              />
            </div>
          </FilterField>
          <div className="w-36">
            <DateInput label="De la" value={dateFrom} onChange={setDateFrom} size="sm" />
          </div>
          <div className="w-36">
            <DateInput
              label="Până la"
              value={dateTo}
              onChange={setDateTo}
              min={dateFrom ?? undefined}
              size="sm"
            />
          </div>
          {filtersActive && (
            <Button variant="ghost" size="sm" icon={<X aria-hidden />} onClick={resetFilters}>
              Resetează
            </Button>
          )}
        </FilterBar>
      )}

      <ListDetail
        storageKey="ecotrack.pane.orders"
        selected={drawer.kind === 'detail' && openOrder !== null}
        onCloseDetail={() => setDrawer({ kind: 'none' })}
        detailTitle={openOrder ? `Comanda #${openOrder.number}` : 'Detalii comandă'}
        list={list}
        detail={
          openOrder && (
            <OrderDetailPane
              order={openOrder}
              onEdit={() => setDrawer({ kind: 'edit', orderId: openOrder.id })}
              onDelete={() =>
                void removeOrders([openOrder.id], `Comanda #${openOrder.number} va fi ștearsă.`)
              }
            />
          )
        }
      />

      {drawer.kind === 'edit' && openOrder && (
        <OrderFormDrawer
          key={`edit-${openOrder.id}`}
          order={openOrder}
          onClose={() => setDrawer({ kind: 'detail', orderId: openOrder.id })}
        />
      )}

      {drawer.kind === 'create' && (
        <OrderFormDrawer key="create" onClose={() => setDrawer({ kind: 'none' })} />
      )}

    </Workbench>
  );
}
