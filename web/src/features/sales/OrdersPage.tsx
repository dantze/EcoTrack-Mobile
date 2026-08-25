/**
 * Comenzi — the main Sales screen.
 *
 * One dense, sortable table of every order with a filter strip on top; the
 * record detail and the create/edit form are slide-overs, so the list never
 * unmounts and the filters survive.
 */

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  DateInput,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
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
import {
  ORDER_TYPES,
  type Order,
  type OrderTypeTag,
  clientName,
} from '@/types/domain';
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

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<RowKey>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>({ kind: 'none' });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

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

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (needle) {
        const haystack = [
          String(order.number),
          clientName(order.client),
          orderAddress(order) ?? '',
          orderSummary(order),
        ];
        if (!haystack.some((value) => value.toLowerCase().includes(needle))) return false;
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
  }, [orders, search, typeFilter, clientFilter, dateFrom, dateTo]);

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
            : `${rows.length} din ${orders.length} comenzi${filtersActive ? ' (filtrate)' : ''}`
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

      <FilterBar>
        <FilterField label="Căutare">
          <SearchInput
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
          onRowClick={(order) => setDrawer({ kind: 'detail', orderId: order.id })}
          selectedKeys={selected}
          onSelectionChange={setSelected}
          bulkActions={
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
          }
          empty={
            <EmptyState
              title={filtersActive ? 'Nicio comandă pentru filtrele curente' : 'Nu există comenzi'}
              body={
                filtersActive
                  ? 'Modificați filtrele sau resetați-le.'
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
          }
        />
      )}

      {drawer.kind === 'detail' && openOrder && (
        <OrderDetailDrawer
          order={openOrder}
          onClose={() => setDrawer({ kind: 'none' })}
          onEdit={() => setDrawer({ kind: 'edit', orderId: openOrder.id })}
          onDelete={() =>
            void removeOrders([openOrder.id], `Comanda #${openOrder.number} va fi ștearsă.`)
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
