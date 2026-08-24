/**
 * Clienți — dense table of every client, create/edit in a drawer.
 *
 * Deletion keeps the mobile guard: ask the backend whether the client has
 * orders and escalate the confirmation when it does.
 */

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  Select,
  type Column,
  type SelectOption,
} from '@/components/ui';
import { type Client, clientName } from '@/types/domain';
import { ClientFormDrawer } from './components/ClientFormDrawer';
import { matchesClient } from './components/ClientPicker';
import { ErrorNotice, FilterBar, FilterField, SearchInput } from './components/FilterBar';
import { OrderFormDrawer } from './components/OrderFormDrawer';
import { Toaster, errorMessage, toast } from './components/Toaster';
import { useConfirm } from './components/useConfirm';
import { useCheckClientHasOrders, useClients, useDeleteClient, useOrders } from './queries';

const KIND_OPTIONS: SelectOption<string>[] = [
  { value: '', label: 'Toate tipurile' },
  { value: 'individual', label: 'Persoane fizice' },
  { value: 'company', label: 'Persoane juridice' },
];

type DrawerState = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; clientId: number };

function fiscalCode(client: Client): string {
  return (client.type === 'company' ? client.CUI : client.CNP) ?? '—';
}

export function ClientsPage() {
  const clientsQuery = useClients();
  const ordersQuery = useOrders();
  const deleteClient = useDeleteClient();
  const checkHasOrders = useCheckClientHasOrders();
  const { confirm, confirmDialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>({ kind: 'none' });
  const [orderClient, setOrderClient] = useState<Client | null>(null);

  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);

  const orderCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const order of ordersQuery.data ?? []) {
      counts.set(order.client.id, (counts.get(order.client.id) ?? 0) + 1);
    }
    return counts;
  }, [ordersQuery.data]);

  const rows = useMemo(
    () =>
      clients.filter(
        (client) =>
          matchesClient(client, search) && (!kindFilter || client.type === kindFilter),
      ),
    [clients, search, kindFilter],
  );

  const filtersActive = search !== '' || kindFilter !== '';
  const openClient =
    drawer.kind === 'edit' ? (clients.find((entry) => entry.id === drawer.clientId) ?? null) : null;

  const removeClient = async (client: Client) => {
    const label = clientName(client);
    let hasOrders = false;
    try {
      hasOrders = await checkHasOrders(client.id);
    } catch (error) {
      toast.error(errorMessage(error, 'Nu s-a putut verifica dacă clientul are comenzi'));
      return;
    }

    const confirmed = await confirm({
      title: `Șterge clientul „${label}”?`,
      body: hasOrders
        ? 'Acest client are comenzi în baza de date. Toate comenzile asociate vor fi șterse.'
        : 'Această acțiune nu poate fi anulată.',
      confirmLabel: 'Șterge',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteClient.mutateAsync(client.id);
      setDrawer({ kind: 'none' });
      toast.success('Clientul a fost șters.');
    } catch (error) {
      toast.error(errorMessage(error, 'Nu s-a putut șterge clientul'));
    }
  };

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Nume',
      width: '18rem',
      sortValue: (client) => clientName(client).toLowerCase(),
      render: (client) => <span className="font-medium">{clientName(client)}</span>,
    },
    {
      key: 'type',
      header: 'Tip',
      width: '6rem',
      sortValue: (client) => client.type,
      render: (client) => (
        <Badge tone={client.type === 'company' ? 'info' : 'neutral'}>
          {client.type === 'company' ? 'PJ' : 'PF'}
        </Badge>
      ),
    },
    {
      key: 'fiscal',
      header: 'CUI / CNP',
      width: '10rem',
      sortValue: (client) => fiscalCode(client),
      render: (client) => <span className="tabular">{fiscalCode(client)}</span>,
    },
    {
      key: 'phone',
      header: 'Telefon',
      width: '10rem',
      sortValue: (client) => client.phone ?? '',
      render: (client) => <span className="tabular">{client.phone ?? '—'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      width: '14rem',
      sortValue: (client) => (client.email ?? '').toLowerCase(),
      render: (client) => (
        <span className="block max-w-[14rem] truncate">{client.email ?? '—'}</span>
      ),
    },
    {
      key: 'address',
      header: 'Adresă',
      sortValue: (client) => (client.address ?? '').toLowerCase(),
      render: (client) => (
        <span className="block max-w-[20rem] truncate text-ink-muted">
          {client.address ?? '—'}
        </span>
      ),
    },
    {
      key: 'orders',
      header: 'Comenzi',
      width: '6rem',
      align: 'right',
      sortValue: (client) => orderCounts.get(client.id) ?? 0,
      render: (client) => <span className="tabular">{orderCounts.get(client.id) ?? 0}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '5rem',
      align: 'right',
      render: (client) => (
        <button
          type="button"
          className="text-xs font-medium text-red-600 hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            void removeClient(client);
          }}
        >
          Șterge
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Clienți"
        subtitle={
          clientsQuery.isLoading
            ? 'Se încarcă…'
            : `${rows.length} din ${clients.length} clienți${filtersActive ? ' (filtrate)' : ''}`
        }
        actions={
          <>
            <Button
              variant="secondary"
              loading={clientsQuery.isFetching}
              onClick={() => void clientsQuery.refetch()}
            >
              Reîmprospătează
            </Button>
            <Button variant="primary" onClick={() => setDrawer({ kind: 'create' })}>
              + Client
            </Button>
          </>
        }
      />

      <FilterBar>
        <FilterField label="Căutare">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Nume, CUI/CNP, email, telefon"
          />
        </FilterField>
        <FilterField label="Tip">
          <div className="w-48">
            <Select value={kindFilter} options={KIND_OPTIONS} onChange={setKindFilter} />
          </div>
        </FilterField>
        {filtersActive && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setKindFilter('');
            }}
          >
            Resetează
          </Button>
        )}
      </FilterBar>

      {clientsQuery.isError ? (
        <ErrorNotice
          message="Nu s-au putut prelua clienții."
          onRetry={() => void clientsQuery.refetch()}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(client) => client.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          loading={clientsQuery.isLoading}
          activeKey={openClient?.id ?? null}
          onRowClick={(client) => setDrawer({ kind: 'edit', clientId: client.id })}
          empty={
            <EmptyState
              title={filtersActive ? 'Niciun client pentru filtrele curente' : 'Nu există clienți'}
              body={
                filtersActive
                  ? 'Modificați căutarea sau filtrul de tip, ori resetați-le.'
                  : 'Adăugați primul client pentru a putea crea comenzi.'
              }
              action={
                filtersActive ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setKindFilter('');
                    }}
                  >
                    Resetează filtrele
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => setDrawer({ kind: 'create' })}>
                    + Client
                  </Button>
                )
              }
            />
          }
        />
      )}

      {drawer.kind === 'create' && (
        <ClientFormDrawer
          key="create"
          onClose={() => setDrawer({ kind: 'none' })}
          onCreated={setOrderClient}
        />
      )}

      {/* "Salvează și comandă" — create the client, then its first order. */}
      {orderClient && (
        <OrderFormDrawer
          key={`order-${orderClient.id}`}
          initialClient={orderClient}
          onClose={() => setOrderClient(null)}
        />
      )}

      {drawer.kind === 'edit' && openClient && (
        <ClientFormDrawer
          key={`edit-${openClient.id}`}
          client={openClient}
          onClose={() => setDrawer({ kind: 'none' })}
        />
      )}

      {confirmDialog}
      <Toaster />
    </>
  );
}
