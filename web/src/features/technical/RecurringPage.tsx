/**
 * Igienizări recurente — the recurring sanitation plans.
 *
 * The unassigned tab is the default because it is the only actionable queue:
 * a plan without a route generates no tasks, so it is silently invisible work
 * until a dispatcher puts it on a route.
 *
 * `?plan=<id>` opens that plan's drawer — the command palette's entry point and
 * a shareable link to one plan.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  PageHeader,
  Tabs,
  TextInput,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { ClientCell, formatDate, weekdayLabel } from '@/components/domain';
import { useDeepLink } from '@/lib/deepLink';
import { useShortcuts } from '@/lib/hotkeys';
import { recordUse } from '@/lib/recents';
import { matchesQuery } from '@/lib/search';
import { clientName } from '@/types/domain';
import type { RecurringIgienizare } from '@/types/domain';
import {
  useAssignRecurringRoute,
  useDeactivateRecurring,
  useRecurring,
  useRoutes,
} from './queries';
import type { RecurringScope } from './queries';
import {
  driverLabel,
  errorMessage,
  frequencyDetail,
  frequencyLabel,
  routeLabel,
} from './utils';
import {
  AddressCell,
  DetailList,
  DetailRow,
  ErrorBlock,
  LocationBlock,
  Toolbar,
} from './components/display';
import { FeedbackProvider, useFeedback } from './components/feedback';
import { RoutePickerModal } from './components/pickers';

export function RecurringPage() {
  return (
    <FeedbackProvider>
      <RecurringScreen />
    </FeedbackProvider>
  );
}

const TAB_TITLES: Record<RecurringScope, string> = {
  unassigned: 'Neasignate',
  active: 'Active',
  all: 'Toate',
};

/** DOM id so the "/" shortcut can put the cursor in the search box. */
const SEARCH_FIELD_ID = 'recurring-search';

function RecurringScreen() {
  const { toast, confirm } = useFeedback();

  const [scope, setScope] = useState<RecurringScope>('unassigned');
  const [query, setQuery] = useState('');
  const [openPlan, setOpenPlan] = useState<RecurringIgienizare | null>(null);
  const [assignTarget, setAssignTarget] = useState<RecurringIgienizare | null>(null);

  const plansQuery = useRecurring(scope);
  // Always known so the tab can carry the size of the actionable queue.
  const unassignedQuery = useRecurring('unassigned');
  const routesQuery = useRoutes();
  // A linked plan is often assigned and therefore not in the default
  // "unassigned" tab, so the deep-link effect below reads from the full list
  // rather than whichever tab happens to be showing.
  const allPlansQuery = useRecurring('all');

  const assignRoute = useAssignRecurringRoute();
  const deactivate = useDeactivateRecurring();

  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);

  const deepLink = useDeepLink();
  const linkedPlanId = deepLink.number('plan');
  const allPlans = allPlansQuery.data;

  useEffect(() => {
    if (linkedPlanId === null) return;
    // Wait for the full list before giving up on the id — clearing the param
    // early would make the link a no-op on a cold cache.
    if (!allPlans) return;
    const plan = allPlans.find((candidate) => candidate.id === linkedPlanId);
    if (plan) {
      // Switch to the tab that can actually show it, so closing the drawer does
      // not leave the operator staring at a list the plan is not in.
      setScope('all');
      setOpenPlan(plan);
      recordUse('recurring', plan.id);
    }
    deepLink.clear('plan');
  }, [linkedPlanId, allPlans, deepLink]);

  useShortcuts([
    {
      combo: '/',
      description: 'Focus pe câmpul de căutare',
      group: 'Igienizări recurente',
      run: () => document.getElementById(SEARCH_FIELD_ID)?.focus(),
    },
    {
      combo: 'u',
      description: 'Arată planurile neasignate',
      group: 'Igienizări recurente',
      run: () => setScope('unassigned'),
    },
    {
      combo: 'a',
      description: 'Arată toate planurile',
      group: 'Igienizări recurente',
      run: () => setScope('all'),
    },
    {
      combo: 'r',
      description: 'Reîncarcă planurile',
      group: 'Igienizări recurente',
      run: () => void plansQuery.refetch(),
    },
  ]);

  const filtered = useMemo(
    () =>
      plans.filter((plan) =>
        matchesQuery(
          query,
          clientName(plan.client),
          plan.sanitationLocationAddress,
          plan.contact,
          plan.subscription?.name,
          plan.route ? routeLabel(plan.route) : null,
        ),
      ),
    [plans, query],
  );

  const handleDeactivate = async (plan: RecurringIgienizare) => {
    const ok = await confirm({
      title: 'Dezactivează planul',
      body: `Oprești igienizările recurente pentru „${clientName(plan.client)}”? Nu se mai generează sarcini noi.`,
      confirmLabel: 'Dezactivează',
      destructive: true,
    });
    if (!ok) return;

    deactivate.mutate(plan.id, {
      onSuccess: () => {
        toast.success('Planul a fost dezactivat.');
        setOpenPlan(null);
      },
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  const columns: Column<RecurringIgienizare>[] = [
    {
      key: 'client',
      header: 'Client',
      sortValue: (plan) => clientName(plan.client),
      render: (plan) => <ClientCell client={plan.client} />,
    },
    {
      key: 'address',
      header: 'Adresă',
      sortValue: (plan) => plan.sanitationLocationAddress,
      render: (plan) => <AddressCell address={plan.sanitationLocationAddress} />,
    },
    {
      key: 'frequency',
      header: 'Frecvență',
      width: '9rem',
      sortValue: (plan) => plan.frequencyDays,
      render: (plan) => frequencyLabel(plan.frequencyDays),
    },
    {
      key: 'startDate',
      header: 'Început',
      width: '8.5rem',
      sortValue: (plan) => plan.startDate,
      render: (plan) => <span className="tabular">{formatDate(plan.startDate)}</span>,
    },
    {
      key: 'lastGenerated',
      header: 'Ultima generare',
      width: '10rem',
      sortValue: (plan) => plan.lastGeneratedDate,
      render: (plan) =>
        plan.lastGeneratedDate ? (
          <span className="tabular">{formatDate(plan.lastGeneratedDate)}</span>
        ) : (
          <span className="text-xs text-ink-subtle">niciodată</span>
        ),
    },
    {
      key: 'route',
      header: 'Rută',
      width: '11rem',
      sortValue: (plan) => (plan.route ? routeLabel(plan.route) : null),
      render: (plan) =>
        plan.route ? (
          <span className="block truncate">{routeLabel(plan.route)}</span>
        ) : (
          <Badge tone="warning">Neasignat</Badge>
        ),
    },
    {
      key: 'active',
      header: 'Stare',
      width: '6.5rem',
      sortValue: (plan) => (plan.active ? 1 : 0),
      render: (plan) =>
        plan.active ? <Badge tone="success">Activ</Badge> : <Badge tone="neutral">Inactiv</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: '11rem',
      align: 'right',
      render: (plan) => (
        <span className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => setAssignTarget(plan)}>
            {plan.route ? 'Schimbă ruta' : 'Asignează rută'}
          </Button>
          {plan.active && (
            <Button size="sm" variant="ghost" onClick={() => void handleDeactivate(plan)}>
              Dezactivează
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Igienizări recurente"
        subtitle={
          plansQuery.isPending
            ? 'Se încarcă…'
            : `${filtered.length} planuri · ${TAB_TITLES[scope].toLowerCase()}`
        }
      />

      <Tabs
        items={[
          {
            id: 'unassigned',
            label: TAB_TITLES.unassigned,
            count: unassignedQuery.data?.length,
          },
          { id: 'active', label: TAB_TITLES.active },
          { id: 'all', label: TAB_TITLES.all },
        ]}
        active={scope}
        onChange={(id) => setScope(id as RecurringScope)}
      />

      <Toolbar>
        <div className="w-72">
          <TextInput
            id={SEARCH_FIELD_ID}
            label="Căutare"
            placeholder="client, adresă, abonament, rută…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {scope === 'unassigned' && (
          <p className="pb-1.5 text-xs text-ink-muted">
            Planurile fără rută nu generează sarcini — asignează-le pentru a intra în producție.
          </p>
        )}
      </Toolbar>

      {plansQuery.error ? (
        <ErrorBlock error={plansQuery.error} onRetry={() => void plansQuery.refetch()} />
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(plan) => plan.id}
          initialSort={{ key: 'client', dir: 'asc' }}
          loading={plansQuery.isPending}
          activeKey={openPlan?.id ?? null}
          onRowClick={(plan) => setOpenPlan(plan)}
          empty={
            query ? (
              <EmptyState
                title="Niciun rezultat pentru căutarea curentă"
                body="Ajustează căutarea sau golește câmpul."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                    Golește căutarea
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title={
                  scope === 'unassigned'
                    ? 'Nicio igienizare recurentă neasignată'
                    : 'Niciun plan recurent'
                }
                body={
                  scope === 'unassigned'
                    ? 'Toate planurile au deja o rută.'
                    : 'Planurile recurente se creează din modulul de vânzări.'
                }
              />
            )
          }
        />
      )}

      <RoutePickerModal
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        title="Asignează planul pe rută"
        subtitle={
          assignTarget
            ? `${clientName(assignTarget.client)} — ${frequencyLabel(assignTarget.frequencyDays)}. Sarcinile se generează automat.`
            : undefined
        }
        routes={routesQuery.data}
        isPending={routesQuery.isPending}
        error={routesQuery.error}
        excludeRouteId={assignTarget?.route?.id ?? null}
        busy={assignRoute.isPending}
        onSelect={(route) => {
          if (!assignTarget) return;
          assignRoute.mutate(
            { planId: assignTarget.id, routeId: route.id },
            {
              onSuccess: () => {
                toast.success(
                  `Planul pentru ${clientName(assignTarget.client)} a fost asignat pe ${routeLabel(route)}.`,
                );
                setAssignTarget(null);
              },
              onError: (error) => toast.error(errorMessage(error)),
            },
          );
        }}
      />

      <Drawer
        open={openPlan !== null}
        onClose={() => setOpenPlan(null)}
        title={openPlan ? clientName(openPlan.client) : 'Plan recurent'}
        width="md"
        footer={
          openPlan && (
            <>
              {openPlan.active && (
                <Button variant="danger" onClick={() => void handleDeactivate(openPlan)}>
                  Dezactivează
                </Button>
              )}
              <Button variant="primary" onClick={() => setAssignTarget(openPlan)}>
                {openPlan.route ? 'Schimbă ruta' : 'Asignează rută'}
              </Button>
            </>
          )
        }
      >
        {openPlan && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              {openPlan.active ? (
                <Badge tone="success">Activ</Badge>
              ) : (
                <Badge tone="neutral">Inactiv</Badge>
              )}
              {!openPlan.route && <Badge tone="warning">Fără rută</Badge>}
              <span className="tabular text-xs text-ink-subtle">#{openPlan.id}</span>
            </div>

            <section>
              <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                Plan
              </h3>
              <DetailList>
                <DetailRow label="Frecvență">
                  {frequencyDetail(openPlan.frequencyDays)}
                </DetailRow>
                <DetailRow label="Început">{formatDate(openPlan.startDate)}</DetailRow>
                <DetailRow label="Sfârșit">
                  {openPlan.isIndefinite ? 'Nedeterminat' : formatDate(openPlan.endDate)}
                </DetailRow>
                <DetailRow label="Ultima generare">
                  {openPlan.lastGeneratedDate ? formatDate(openPlan.lastGeneratedDate) : 'Niciodată'}
                </DetailRow>
                <DetailRow label="Abonament">{openPlan.subscription?.name ?? '—'}</DetailRow>
              </DetailList>
            </section>

            <section>
              <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                Alocare
              </h3>
              <DetailList>
                <DetailRow label="Rută">
                  {openPlan.route ? routeLabel(openPlan.route) : 'Neasignat'}
                </DetailRow>
                <DetailRow label="Șofer">{driverLabel(openPlan.route?.employee)}</DetailRow>
                <DetailRow label="Ziua rutei">
                  {openPlan.route ? weekdayLabel(openPlan.route.dayOfWeek) : '—'}
                </DetailRow>
              </DetailList>
            </section>

            <section>
              <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                Client și locație
              </h3>
              <DetailList>
                <DetailRow label="Client">{clientName(openPlan.client)}</DetailRow>
                <DetailRow label="Contact">{openPlan.contact ?? '—'}</DetailRow>
                <DetailRow label="Telefon">{openPlan.client.phone ?? '—'}</DetailRow>
                <DetailRow label="Adresă">
                  {/* TODO(map): show this pin on a map pane once one exists. */}
                  <LocationBlock
                    address={openPlan.sanitationLocationAddress}
                    coordinates={openPlan.sanitationLocationCoordinates}
                  />
                </DetailRow>
                <DetailRow label="Detalii">
                  <span className="whitespace-pre-wrap">{openPlan.details ?? '—'}</span>
                </DetailRow>
              </DetailList>
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
