/**
 * Comenzi — the main Sales screen.
 *
 * One dense, sortable table of every order with a filter strip on top; the
 * record detail and the create/edit form are slide-overs, so the list never
 * unmounts and the filters survive.
 *
 * Two entry points besides clicking a row: `?comanda=<id>` opens that order's
 * drawer and `?nou=1` opens an empty form, which is how the command palette
 * (⌘K) reaches this screen and what makes an order link shareable.
 *
 * **Curente vs Arhivă.** The list defaults to work that is still live;
 * fulfilled orders move to the Arhivă tab, read-only. "Fulfilled" is DERIVED
 * by `isFulfilled` in `@/lib/orderLifecycle` — the same function the map's
 * `done` lifecycle uses — never stored, so there is nothing to keep in sync and
 * nothing to un-archive: an order comes back the moment one of its tasks
 * reopens. Unlike the active/inactive split TODO-11 removed from Abonamente
 * (which surfaced a soft-delete flag as if it were a status), this is a real
 * state an order actually reaches.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  DateInput,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
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
import { useDeepLink } from '@/lib/deepLink';
import { isFulfilled } from '@/lib/orderLifecycle';
import { todayIso } from '@/features/technical/utils';
import { includesFolded } from '@/lib/search';
import { useShortcuts } from '@/lib/hotkeys';
import { recordUse } from '@/lib/recents';
import { ErrorNotice, FilterBar, FilterField, SearchInput } from './components/FilterBar';
import { OrderDetailDrawer } from './components/OrderDetailDrawer';
import { OrderFormDrawer } from './components/OrderFormDrawer';
import { Toaster, errorMessage, toast } from './components/Toaster';
import { useConfirm } from './components/useConfirm';
import { orderAddress, orderDateLabel, orderPrimaryDate, orderSummary } from './orderModel';
import { useClients, useDeleteOrders, useOrderTaskStatuses, useOrders } from './queries';

const TYPE_OPTIONS: SelectOption<string>[] = [
  { value: '', label: 'Toate tipurile' },
  ...ORDER_TYPES.map((type) => ({ value: type, label: ORDER_TYPE_LABELS[type] })),
];

/**
 * `toate` exists so an operator can still see one uninterrupted list — the
 * split is a default, not a wall.
 */
type OrderTab = 'curente' | 'arhiva' | 'toate';

type DrawerState =
  | { kind: 'none' }
  | { kind: 'detail'; orderId: number }
  | { kind: 'create' }
  | { kind: 'edit'; orderId: number };

export function OrdersPage() {
  const ordersQuery = useOrders();
  const clientsQuery = useClients();
  const deleteOrders = useDeleteOrders();
  const { confirm, confirmDialog } = useConfirm();

  const [tab, setTab] = useState<OrderTab>('curente');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<RowKey>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>({ kind: 'none' });
  const searchRef = useRef<HTMLInputElement>(null);

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  // ── Deep links from the command palette and from shared URLs ────────────
  const deepLink = useDeepLink();
  const linkedOrderId = deepLink.number('comanda');
  const wantsNew = deepLink.flag('nou');

  useEffect(() => {
    if (linkedOrderId === null) return;
    setDrawer({ kind: 'detail', orderId: linkedOrderId });
    recordUse('order', linkedOrderId);
    deepLink.clear('comanda');
  }, [linkedOrderId, deepLink]);

  useEffect(() => {
    if (!wantsNew) return;
    setDrawer({ kind: 'create' });
    deepLink.clear('nou');
  }, [wantsNew, deepLink]);

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

  /**
   * Task evidence is fanned out one request per order, so it lands after the
   * list does. Until it is here NOTHING is archived: hiding a live order from
   * Comenzi on incomplete evidence is a far worse error than showing a
   * finished one for another second, and it also stops rows flickering between
   * the two tabs while the statuses stream in.
   *
   * Caveat worth knowing: `GET /tasks/order/{id}/exists` reports ONE task's
   * status, not a roll-up of all of them, so an order that somehow produced
   * several tasks is judged on whichever the backend returns first. The map,
   * which loads every task, summarises properly. Both feed the same
   * `isFulfilled`; only the evidence differs. A batch/roll-up endpoint would
   * close the gap.
   */
  const statuses = statusesQuery.data;
  const archivedIds = useMemo(() => {
    if (!statuses) return new Set<number>();
    const today = todayIso();
    return new Set(
      orders
        .filter((order) => isFulfilled(order, statuses[order.id] ?? null, today))
        .map((order) => order.id),
    );
  }, [orders, statuses]);

  const tabCounts = useMemo(
    () => ({
      curente: orders.length - archivedIds.size,
      arhiva: archivedIds.size,
      toate: orders.length,
    }),
    [orders.length, archivedIds],
  );

  const viewingArchive = tab === 'arhiva';

  const clientOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: '', label: 'Toți clienții' },
      ...(clientsQuery.data ?? [])
        .map((client) => ({ value: String(client.id), label: clientName(client) }))
        .sort((left, right) => left.label.localeCompare(right.label, 'ro')),
    ],
    [clientsQuery.data],
  );

  const rows = useMemo(() => {
    const needle = search.trim();
    return orders.filter((order) => {
      if (tab === 'curente' && archivedIds.has(order.id)) return false;
      if (tab === 'arhiva' && !archivedIds.has(order.id)) return false;
      if (needle) {
        const haystack = [
          String(order.number),
          clientName(order.client),
          orderAddress(order) ?? '',
          orderSummary(order),
        ];
        // Diacritic-insensitive: a typed "bucuresti" has to find "București".
        if (!haystack.some((value) => includesFolded(value, needle))) return false;
      }
      if (typeFilter && order.orderType !== typeFilter) return false;
      if (clientFilter && String(order.client.id) !== clientFilter) return false;
      if (dateFrom || dateTo) {
        const date = orderPrimaryDate(order);
        if (!date) return false;
        const day = date.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
      }
      return true;
    });
  }, [orders, tab, archivedIds, search, typeFilter, clientFilter, dateFrom, dateTo]);

  const filtersActive =
    search !== '' || typeFilter !== '' || clientFilter !== '' || dateFrom !== null || dateTo !== null;

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

  return (
    <>
      <PageHeader
        title="Comenzi"
        subtitle={
          ordersQuery.isLoading
            ? 'Se încarcă…'
            : `${rows.length} din ${tabCounts[tab]} comenzi${filtersActive ? ' (filtrate)' : ''}`
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void ordersQuery.refetch()}
              loading={ordersQuery.isFetching}
            >
              Reîmprospătează
            </Button>
            <Button variant="primary" onClick={() => setDrawer({ kind: 'create' })}>
              + Comandă
            </Button>
          </>
        }
      />

      <Tabs
        active={tab}
        onChange={(id) => {
          setTab(id as OrderTab);
          // Selection is per-tab: carrying ids into a read-only view would
          // leave a bulk-delete bar armed over rows that cannot be deleted.
          setSelected(new Set());
        }}
        items={[
          { id: 'curente', label: 'Curente', count: tabCounts.curente },
          { id: 'arhiva', label: 'Arhivă', count: tabCounts.arhiva },
          { id: 'toate', label: 'Toate', count: tabCounts.toate },
        ]}
      />

      {viewingArchive && (
        <p className="border-b border-border bg-surface-sunken px-5 py-2 text-sm text-ink-muted">
          Comenzi finalizate — doar vizualizare. Arhivarea se deduce din sarcinile
          comenzii; nu există dezarhivare, comanda revine în „Curente” dacă o
          sarcină se redeschide.
        </p>
      )}

      <FilterBar>
        <FilterField label="Căutare">
          <SearchInput
            inputRef={searchRef}
            value={search}
            onChange={setSearch}
            placeholder="Număr, client, adresă, produs"
          />
        </FilterField>
        <FilterField label="Tip">
          <div className="w-40">
            <Select value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} />
          </div>
        </FilterField>
        <FilterField label="Client">
          <div className="w-56">
            <Select
              value={clientFilter}
              options={clientOptions}
              onChange={setClientFilter}
              searchable
            />
          </div>
        </FilterField>
        <div className="w-36">
          <DateInput label="De la" value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="w-36">
          <DateInput label="Până la" value={dateTo} onChange={setDateTo} min={dateFrom ?? undefined} />
        </div>
        {filtersActive && (
          <Button variant="ghost" onClick={resetFilters}>
            Resetează
          </Button>
        )}
      </FilterBar>

      {ordersQuery.isError ? (
        <ErrorNotice
          message="Nu s-au putut prelua comenzile."
          onRetry={() => void ordersQuery.refetch()}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(order) => order.id}
          initialSort={{ key: 'date', dir: 'desc' }}
          loading={ordersQuery.isLoading}
          activeKey={openOrder?.id ?? null}
          onRowClick={(order) => openDetail(order.id)}
          selectedKeys={viewingArchive ? undefined : selected}
          onSelectionChange={viewingArchive ? undefined : setSelected}
          bulkActions={
            viewingArchive ? undefined : (
              <Button
                size="sm"
                variant="danger"
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
            )
          }
          empty={
            <EmptyState
              title={
                filtersActive
                  ? 'Nicio comandă pentru filtrele curente'
                  : viewingArchive
                    ? 'Arhiva este goală'
                    : 'Nu există comenzi'
              }
              body={
                filtersActive
                  ? 'Modificați filtrele sau resetați-le.'
                  : viewingArchive
                    ? 'Comenzile ajung aici automat când toate sarcinile lor sunt finalizate.'
                    : 'Creați prima comandă pentru un client existent.'
              }
              action={
                filtersActive ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Resetează filtrele
                  </Button>
                ) : viewingArchive ? undefined : (
                  <Button variant="primary" onClick={() => setDrawer({ kind: 'create' })}>
                    + Comandă
                  </Button>
                )
              }
            />
          }
        />
      )}

      {drawer.kind === 'detail' && openOrder && (
        // Read-only is a property of the ARHIVĂ VIEW, not of the record: the
        // same order opened from „Toate” keeps Editează/Șterge. Archiving is
        // derived from task data that can itself be wrong, so there has to be
        // one place left to correct a mis-archived order — and a delete of a
        // finished order is a legitimate action, not an edit to live work.
        <OrderDetailDrawer
          order={openOrder}
          archived={viewingArchive}
          onClose={() => setDrawer({ kind: 'none' })}
          onEdit={
            viewingArchive ? undefined : () => setDrawer({ kind: 'edit', orderId: openOrder.id })
          }
          onDelete={
            viewingArchive
              ? undefined
              : () =>
                  void removeOrders(
                    [openOrder.id],
                    `Comanda #${openOrder.number} va fi ștearsă.`,
                  )
          }
        />
      )}

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

      {confirmDialog}
      <Toaster />
    </>
  );
}
