/**
 * Clienți — the list, plus a reading pane for the selected client.
 *
 * A single click selects and shows the client (contact details and every order
 * they have placed, straight out of the cache the list already filled); a
 * double click, or Editează in the pane, opens the form drawer. That ordering
 * matters: looking someone up to read a phone number is the common case, and
 * it used to cost an editable form over the list.
 *
 * Deletion keeps the mobile guard: ask the backend whether the client has
 * orders and escalate the confirmation when it does.
 *
 * `?client=<id>` opens that client's drawer and `?nou=1` opens an empty form —
 * the entry points the command palette (⌘K) uses.
 */

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { CommandBar, ListDetail, ToolbarSeparator, Workbench } from '@/components/layout';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Select,
  type Column,
  type SelectOption,
} from '@/components/ui';
import { useDeepLink, useDeepLinkOnce, useDeepLinkFlagOnce } from '@/lib/deepLink';
import { useShortcuts } from '@/lib/hotkeys';
import { recordUse } from '@/lib/recents';
import { type Client, clientName } from '@/types/domain';
import { ClientDetailPane } from './components/ClientDetailPane';
import { ClientFormDrawer } from './components/ClientFormDrawer';
import { matchesClient } from './components/ClientPicker';
import { ErrorNotice, FilterBar, FilterField, SearchInput } from './components/FilterBar';
import { OrderFormDrawer } from './components/OrderFormDrawer';
import { errorMessage, toast } from './components/Toaster';
import { useConfirm } from './components/useConfirm';
import { useCheckClientHasOrders, useClients, useDeleteClient, useOrders } from './queries';

const KIND_OPTIONS: SelectOption<string>[] = [
  { value: '', label: 'Toate tipurile' },
  { value: 'individual', label: 'Persoane fizice' },
  { value: 'company', label: 'Persoane juridice' },
];

type DrawerState = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; clientId: number };

/** Which client the reading pane is showing, independent of the edit drawer. */
type Selection = number | null;

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
  const [selectedId, setSelectedId] = useState<Selection>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [orderClient, setOrderClient] = useState<Client | null>(null);
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);

  useDeepLinkOnce('client', useDeepLink().number('client'), (clientId) => {
    // The palette names a client to LOOK at; the pane is that, and the drawer
    // one click further on. Opening straight into a form was the old shape.
    setSelectedId(clientId);
    recordUse('client', clientId);
  });

  useDeepLinkFlagOnce('nou', () => setDrawer({ kind: 'create' }));

  useShortcuts([
    {
      combo: 'n',
      description: 'Client nou',
      group: 'Clienți',
      run: () => setDrawer({ kind: 'create' }),
    },
    {
      combo: '/',
      description: 'Focus pe câmpul de căutare',
      group: 'Clienți',
      run: () => searchRef.current?.focus(),
    },
    {
      combo: 'r',
      description: 'Reîmprospătează lista',
      group: 'Clienți',
      run: () => void clientsQuery.refetch(),
    },
  ]);

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
  const selectedClient =
    selectedId === null ? null : (clients.find((entry) => entry.id === selectedId) ?? null);

  const removeClient = async (client: Client) => {
    const label = clientName(client);
    let hasOrders: boolean;
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
        <Button
          size="sm"
          variant="ghost"
          className="text-danger-600 hover:bg-danger-50"
          onClick={(event) => {
            event.stopPropagation();
            void removeClient(client);
          }}
        >
          Șterge
        </Button>
      ),
    },
  ];

  const resetFilters = () => {
    setSearch('');
    setKindFilter('');
  };

  return (
    <Workbench>
      <CommandBar
        title="Clienți"
        subtitle={
          clientsQuery.isLoading
            ? 'Se încarcă…'
            : `${rows.length} din ${clients.length} clienți${filtersActive ? ' (filtrate)' : ''}`
        }
        tools={
          <>
            <div className="hidden w-56 md:block xl:w-72">
              <SearchInput
                inputRef={searchRef}
                value={search}
                onChange={setSearch}
                placeholder="Nume, CUI/CNP, email, telefon"
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
                <span aria-label="filtre active" className="ml-1 size-1.5 rounded-full bg-primary" />
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
              Client nou
            </Button>
            <ToolbarSeparator />
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw aria-hidden />}
              loading={clientsQuery.isFetching}
              onClick={() => void clientsQuery.refetch()}
            >
              Reîmprospătează
            </Button>
          </>
        }
      />

      {showFilters && (
        <FilterBar>
          <FilterField label="Căutare">
            <div className="md:hidden">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Nume, CUI/CNP, email, telefon"
              />
            </div>
          </FilterField>
          <FilterField label="Tip">
            <div className="w-48">
              <Select value={kindFilter} options={KIND_OPTIONS} onChange={setKindFilter} size="sm" />
            </div>
          </FilterField>
          {filtersActive && (
            <Button variant="ghost" size="sm" icon={<X aria-hidden />} onClick={resetFilters}>
              Resetează
            </Button>
          )}
        </FilterBar>
      )}

      <ListDetail
        storageKey="ecotrack.pane.clients"
        selected={selectedClient !== null}
        onCloseDetail={() => setSelectedId(null)}
        detailTitle={selectedClient ? clientName(selectedClient) : 'Detalii client'}
        list={
          clientsQuery.isError ? (
            <ErrorNotice
              message="Nu s-au putut prelua clienții."
              onRetry={() => void clientsQuery.refetch()}
            />
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(client) => client.id}
              ariaLabel="Clienți"
              initialSort={{ key: 'name', dir: 'asc' }}
              loading={clientsQuery.isLoading}
              activeKey={selectedClient?.id ?? null}
              mobile={{ primary: 'name', secondary: ['phone', 'address'], trailing: 'orders' }}
              onRowClick={(client) => {
                recordUse('client', client.id);
                setSelectedId(client.id);
              }}
              onRowDoubleClick={(client) => setDrawer({ kind: 'edit', clientId: client.id })}
              empty={
                <EmptyState
                  title={
                    filtersActive ? 'Niciun client pentru filtrele curente' : 'Nu există clienți'
                  }
                  body={
                    filtersActive
                      ? 'Modificați căutarea sau filtrul de tip, ori resetați-le.'
                      : 'Adăugați primul client pentru a putea crea comenzi.'
                  }
                  action={
                    filtersActive ? (
                      <Button variant="secondary" onClick={resetFilters}>
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
          )
        }
        detail={
          selectedClient && (
            <ClientDetailPane
              client={selectedClient}
              orders={ordersQuery.data ?? []}
              onEdit={() => setDrawer({ kind: 'edit', clientId: selectedClient.id })}
              onDelete={() => void removeClient(selectedClient)}
              onNewOrder={() => setOrderClient(selectedClient)}
              onOpenOrder={(order) => navigate(`/comenzi?comanda=${order.id}`)}
            />
          )
        }
      />

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
    </Workbench>
  );
}
