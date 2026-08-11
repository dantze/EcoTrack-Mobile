/**
 * Sarcini — every task in one dense, filterable table.
 *
 * The phone app could only show a driver's day; here the dispatcher gets the
 * whole board with inline status and date edits, multi-select, and a single
 * bulk `reassignMany` call to move a batch onto another route.
 */

import { useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  DateInput,
  EmptyState,
  PageHeader,
  Select,
  TextInput,
} from '@/components/ui';
import type { Column, RowKey } from '@/components/ui';
import type { Task } from '@/types/domain';
import { useDrivers, useReassignTasks, useRoutes, useTasks } from './queries';
import {
  driverLabel,
  errorMessage,
  matchesQuery,
  routeLabel,
  taskDate,
  todayIso,
} from './utils';
import { ALL, TASK_STATUS_OPTIONS, TASK_TYPE_OPTIONS } from './constants';
import { AddressCell, ErrorBlock, TaskTypeBadge, Toolbar } from './components/display';
import { InlineDateInput, InlineStatusSelect } from './components/inline';
import { FeedbackProvider, useFeedback } from './components/feedback';
import { RoutePickerModal } from './components/pickers';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';

export function TasksPage() {
  return (
    <FeedbackProvider>
      <TasksScreen />
    </FeedbackProvider>
  );
}

const NO_ROUTE = 'NONE';

function TasksScreen() {
  const { toast } = useFeedback();

  const [status, setStatus] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [date, setDate] = useState<string | null>(null);
  const [route, setRoute] = useState<string>(ALL);
  const [driver, setDriver] = useState<string>(ALL);
  const [query, setQuery] = useState('');

  const [selected, setSelected] = useState<Set<RowKey>>(new Set());
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);

  const tasksQuery = useTasks();
  const routesQuery = useRoutes();
  const driversQuery = useDrivers();
  const reassign = useReassignTasks();

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const filtered = useMemo(
    () =>
      tasks.filter((task) => {
        if (status !== ALL && task.status !== status) return false;
        if (type !== ALL && task.type !== type) return false;
        if (date && taskDate(task) !== date) return false;
        if (route === NO_ROUTE && task.route) return false;
        if (route !== ALL && route !== NO_ROUTE && String(task.route?.id) !== route) return false;
        if (driver !== ALL && String(task.route?.employee?.id) !== driver) return false;
        return matchesQuery(
          query,
          task.clientName,
          task.address,
          task.contactPerson,
          task.productName,
          task.internalNotes,
        );
      }),
    [tasks, status, type, date, route, driver, query],
  );

  const selectedIds = useMemo(
    () =>
      filtered.filter((task) => selected.has(task.id)).map((task) => task.id),
    [filtered, selected],
  );

  const columns: Column<Task>[] = [
    {
      key: 'type',
      header: 'Tip',
      width: '7.5rem',
      sortValue: (task) => task.type,
      render: (task) => <TaskTypeBadge type={task.type} />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '9.5rem',
      sortValue: (task) => task.status,
      render: (task) => <InlineStatusSelect task={task} />,
    },
    {
      key: 'date',
      header: 'Data programată',
      width: '10.5rem',
      sortValue: (task) => taskDate(task),
      render: (task) => <InlineDateInput task={task} />,
    },
    {
      key: 'client',
      header: 'Client',
      sortValue: (task) => task.clientName,
      render: (task) => (
        <span className="block">
          <span className="block truncate font-medium text-ink">
            {task.clientName ?? 'Client necunoscut'}
          </span>
          {task.contactPerson && (
            <span className="block truncate text-xs text-ink-subtle">{task.contactPerson}</span>
          )}
        </span>
      ),
    },
    {
      key: 'address',
      header: 'Adresă',
      sortValue: (task) => task.address,
      render: (task) => <AddressCell address={task.address} />,
    },
    {
      key: 'route',
      header: 'Rută',
      width: '11rem',
      sortValue: (task) => (task.route ? routeLabel(task.route) : null),
      render: (task) =>
        task.route ? (
          <span className="truncate">{routeLabel(task.route)}</span>
        ) : (
          <span className="text-amber-700">Neasignată</span>
        ),
    },
    {
      key: 'driver',
      header: 'Șofer',
      width: '10rem',
      sortValue: (task) => task.route?.employee?.fullName ?? null,
      render: (task) => <span className="truncate">{driverLabel(task.route?.employee)}</span>,
    },
  ];

  const resetFilters = () => {
    setStatus(ALL);
    setType(ALL);
    setDate(null);
    setRoute(ALL);
    setDriver(ALL);
    setQuery('');
  };

  return (
    <>
      <PageHeader
        title="Sarcini"
        subtitle={
          tasksQuery.isPending
            ? 'Se încarcă…'
            : `${filtered.length} din ${tasks.length} sarcini${selected.size > 0 ? ` · ${selected.size} selectate` : ''}`
        }
        actions={
          <Button variant="ghost" onClick={resetFilters}>
            Resetează filtrele
          </Button>
        }
      />

      <Toolbar>
        <div className="w-40">
          <Select
            label="Status"
            value={status}
            options={[{ value: ALL, label: 'Toate statusurile' }, ...TASK_STATUS_OPTIONS]}
            onChange={setStatus}
          />
        </div>

        <div className="w-40">
          <Select
            label="Tip"
            value={type}
            options={[{ value: ALL, label: 'Toate tipurile' }, ...TASK_TYPE_OPTIONS]}
            onChange={setType}
          />
        </div>

        <div className="w-40">
          <DateInput label="Data programată" value={date} onChange={setDate} />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setDate(todayIso())}>
          Azi
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDate(null)} disabled={date === null}>
          Toate datele
        </Button>

        <div className="w-48">
          <Select
            label="Rută"
            searchable
            value={route}
            options={[
              { value: ALL, label: 'Toate rutele' },
              { value: NO_ROUTE, label: 'Fără rută' },
              ...(routesQuery.data ?? []).map((item) => ({
                value: String(item.id),
                label: routeLabel(item),
              })),
            ]}
            onChange={setRoute}
          />
        </div>

        <div className="w-44">
          <Select
            label="Șofer"
            searchable
            value={driver}
            options={[
              { value: ALL, label: 'Toți șoferii' },
              ...(driversQuery.data ?? []).map((item) => ({
                value: String(item.id),
                label: item.fullName,
              })),
            ]}
            onChange={setDriver}
          />
        </div>

        <div className="w-56">
          <TextInput
            label="Căutare"
            placeholder="client, adresă, note…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Toolbar>

      {tasksQuery.error ? (
        <ErrorBlock error={tasksQuery.error} onRetry={() => void tasksQuery.refetch()} />
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(task) => task.id}
          loading={tasksQuery.isPending}
          activeKey={openTaskId}
          onRowClick={(task) => setOpenTaskId(task.id)}
          selectedKeys={selected}
          onSelectionChange={setSelected}
          bulkActions={
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setBulkPickerOpen(true)}
                loading={reassign.isPending}
              >
                Reasignează pe rută
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Golește selecția
              </Button>
            </>
          }
          empty={
            <EmptyState
              title="Nicio sarcină"
              body="Niciun rezultat pentru filtrele curente."
              action={
                <Button size="sm" variant="secondary" onClick={resetFilters}>
                  Resetează filtrele
                </Button>
              }
            />
          }
        />
      )}

      <RoutePickerModal
        open={bulkPickerOpen}
        onClose={() => setBulkPickerOpen(false)}
        title="Reasignează sarcinile"
        subtitle={`${selectedIds.length} sarcini selectate vor fi mutate pe ruta aleasă.`}
        routes={routesQuery.data}
        isPending={routesQuery.isPending}
        error={routesQuery.error}
        busy={reassign.isPending}
        onSelect={(target) => {
          if (selectedIds.length === 0) {
            toast.info('Selectează cel puțin o sarcină.');
            return;
          }
          reassign.mutate(
            { taskIds: selectedIds, routeId: target.id },
            {
              onSuccess: (updated) => {
                toast.success(
                  `${updated.length || selectedIds.length} sarcini mutate pe ${routeLabel(target)}.`,
                );
                setSelected(new Set());
                setBulkPickerOpen(false);
              },
              onError: (error) => toast.error(errorMessage(error)),
            },
          );
        }}
      />

      <TaskDetailDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}
