/**
 * Rute — the dispatch board.
 *
 * Three panes on one screen, which is the whole point of moving off the phone:
 *   left    every route, filterable by date/county/driver, with live progress
 *   middle  the selected route's stops in execution order (drag to reorder)
 *   right   the unassigned queue, dragged directly onto the route
 *
 * Reordering persists through `api.routes.reorderTasks(routeId, taskIds)` —
 * a bare ordered array of ids — and is applied optimistically so the list never
 * snaps back while the request is in flight.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Button,
  DataTable,
  DateInput,
  EmptyState,
  PageHeader,
  Select,
  TextInput,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { formatDate, weekdayLabel } from '@/components/domain';
import type { Route, Task } from '@/types/domain';
import {
  useAssignDriver,
  useCreateRoute,
  useDeleteRoute,
  useDrivers,
  useMoveTaskToRoute,
  useReorderRouteTasks,
  useReassignTasks,
  useRouteTasks,
  useRoutes,
  useTasks,
} from './queries';
import {
  driverLabel,
  errorMessage,
  isUnassigned,
  matchesQuery,
  routeLabel,
  sortByOrderIndex,
  taskProgress,
  todayIso,
} from './utils';
import { ALL, COUNTY_OPTIONS } from './constants';
import { AssignRecurringModal } from './components/AssignRecurringModal';
import { RouteFormModal } from './components/RouteFormModal';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import {
  DispatchTaskCard,
  DraggablePoolTask,
  ROUTE_DROP_ID,
  RouteDropZone,
  SortableRouteTask,
  readDragPayload,
} from './components/dispatch';
import {
  AsyncPanel,
  ErrorBlock,
  PanelHeader,
  ProgressMeter,
  Toolbar,
} from './components/display';
import { FeedbackProvider, useFeedback } from './components/feedback';
import { DriverPickerModal, RoutePickerModal } from './components/pickers';

export function RoutesPage() {
  return (
    <FeedbackProvider>
      <RoutesScreen />
    </FeedbackProvider>
  );
}

const NO_DRIVER = 'NONE';

function RoutesScreen() {
  const { toast, confirm } = useFeedback();

  // --- filters -------------------------------------------------------------
  const [date, setDate] = useState<string | null>(todayIso());
  const [county, setCounty] = useState<string>(ALL);
  const [driver, setDriver] = useState<string>(ALL);
  const [query, setQuery] = useState('');

  // --- selection & overlays ------------------------------------------------
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [poolTargetTask, setPoolTargetTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // --- server state --------------------------------------------------------
  const routesQuery = useRoutes();
  const driversQuery = useDrivers();
  const tasksQuery = useTasks();

  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);

  const filteredRoutes = useMemo(
    () =>
      routes.filter((route) => {
        if (date && route.date !== date) return false;
        if (county !== ALL && route.county !== county) return false;
        if (driver === NO_DRIVER && route.employee) return false;
        if (driver !== ALL && driver !== NO_DRIVER && String(route.employee?.id) !== driver) {
          return false;
        }
        return matchesQuery(query, routeLabel(route), route.county, route.employee?.fullName);
      }),
    [routes, date, county, driver, query],
  );

  // Keep a route selected whenever the filtered list has one to show.
  useEffect(() => {
    const first = filteredRoutes[0];
    if (!first) {
      if (selectedRouteId !== null) setSelectedRouteId(null);
      return;
    }
    if (selectedRouteId === null || !filteredRoutes.some((route) => route.id === selectedRouteId)) {
      setSelectedRouteId(first.id);
    }
  }, [filteredRoutes, selectedRouteId]);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );

  const routeTasksQuery = useRouteTasks(selectedRouteId);
  const routeTasks = useMemo(
    () => sortByOrderIndex(routeTasksQuery.data ?? []),
    [routeTasksQuery.data],
  );
  const routeTaskIds = useMemo(() => routeTasks.map((task) => task.id), [routeTasks]);

  const unassignedTasks = useMemo(() => {
    const all = tasksQuery.data ?? [];
    return all
      .filter(isUnassigned)
      .filter((task) => matchesQuery(query, task.clientName, task.address, task.productName));
  }, [tasksQuery.data, query]);

  // --- mutations -----------------------------------------------------------
  const createRoute = useCreateRoute();
  const deleteRoute = useDeleteRoute();
  const assignDriver = useAssignDriver();
  const reorderTasks = useReorderRouteTasks(selectedRouteId ?? -1);
  const moveTask = useMoveTaskToRoute(selectedRoute);
  const reassignTasks = useReassignTasks();

  // --- drag and drop -------------------------------------------------------
  const sensors = useSensors(
    // A small threshold keeps plain clicks (open the drawer) working.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const payload = readDragPayload(event.active.data.current);
    if (!payload) return;
    const source =
      payload.container === 'route'
        ? routeTasks.find((task) => task.id === payload.taskId)
        : unassignedTasks.find((task) => task.id === payload.taskId);
    setDraggedTask(source ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedTask(null);
    const { active, over } = event;
    if (!over || !selectedRoute) return;

    const payload = readDragPayload(active.data.current);
    if (!payload) return;

    const overTaskId = typeof over.id === 'number' ? over.id : null;

    if (payload.container === 'route') {
      if (overTaskId === null) return; // dropped on the empty zone, order unchanged
      const from = routeTaskIds.indexOf(payload.taskId);
      const to = routeTaskIds.indexOf(overTaskId);
      if (from < 0 || to < 0 || from === to) return;

      reorderTasks.mutate(arrayMove(routeTaskIds, from, to), {
        onError: (error) => toast.error(errorMessage(error)),
      });
      return;
    }

    // Unassigned → route. `over` is either a stop (insert before it) or the
    // drop zone itself (append at the end).
    if (over.id !== ROUTE_DROP_ID && overTaskId === null) return;
    const task = unassignedTasks.find((item) => item.id === payload.taskId);
    if (!task) return;

    const insertAt = overTaskId === null ? routeTaskIds.length : routeTaskIds.indexOf(overTaskId);
    const orderedIds = [...routeTaskIds];
    orderedIds.splice(insertAt < 0 ? orderedIds.length : insertAt, 0, task.id);

    moveTask.mutate(
      { task, orderedIds },
      {
        onSuccess: () =>
          toast.success(`Sarcina a fost adăugată pe ${routeLabel(selectedRoute)}.`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  // --- actions -------------------------------------------------------------
  const handleDelete = async (route: Route) => {
    const ok = await confirm({
      title: 'Șterge ruta',
      body: `Ștergi „${routeLabel(route)}”? Sarcinile de pe această rută devin neasignate.`,
      confirmLabel: 'Șterge',
      destructive: true,
    });
    if (!ok) return;

    deleteRoute.mutate(route.id, {
      onSuccess: () => {
        toast.success(`Ruta „${routeLabel(route)}” a fost ștearsă.`);
        if (selectedRouteId === route.id) setSelectedRouteId(null);
      },
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  const columns: Column<Route>[] = [
    {
      key: 'name',
      header: 'Rută',
      sortValue: (route) => routeLabel(route),
      render: (route) => (
        <span className="block">
          <span className="block truncate font-medium text-ink">{routeLabel(route)}</span>
          <span className="block truncate text-xs text-ink-subtle">
            {route.county ?? 'fără județ'}
          </span>
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Data',
      width: '9rem',
      sortValue: (route) => route.date,
      render: (route) => (
        <span className="block">
          <span className="tabular block">{formatDate(route.date)}</span>
          <span className="block text-xs text-ink-subtle">{weekdayLabel(route.dayOfWeek)}</span>
        </span>
      ),
    },
    {
      key: 'driver',
      header: 'Șofer',
      width: '11rem',
      sortValue: (route) => route.employee?.fullName ?? null,
      render: (route) => (
        <span className={route.employee ? 'truncate' : 'truncate text-amber-700'}>
          {driverLabel(route.employee)}
        </span>
      ),
    },
    {
      key: 'tasks',
      header: 'Sarcini',
      width: '5rem',
      align: 'right',
      sortValue: (route) => route.tasks?.length ?? 0,
      render: (route) => <span className="tabular">{route.tasks?.length ?? 0}</span>,
    },
    {
      key: 'progress',
      header: 'Progres',
      width: '9rem',
      sortValue: (route) => taskProgress(route.tasks).percent,
      render: (route) => <ProgressMeter progress={taskProgress(route.tasks)} />,
    },
    {
      key: 'actions',
      header: '',
      width: '7rem',
      align: 'right',
      render: (route) => (
        <span className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedRouteId(route.id);
              setDriverPickerOpen(true);
            }}
          >
            Șofer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleDelete(route)}>
            Șterge
          </Button>
        </span>
      ),
    },
  ];

  const selectedProgress = taskProgress(routeTasks);
  const filtersActive = date !== null || county !== ALL || driver !== ALL || query !== '';
  const resetFilters = () => {
    setDate(null);
    setCounty(ALL);
    setDriver(ALL);
    setQuery('');
  };

  return (
    <>
      <PageHeader
        title="Rute"
        subtitle={
          routesQuery.isPending
            ? 'Se încarcă…'
            : `${filteredRoutes.length} din ${routes.length} rute · ${unassignedTasks.length} sarcini neasignate`
        }
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            Rută nouă
          </Button>
        }
      />

      <Toolbar>
        <div className="w-40">
          <DateInput label="Data" value={date} onChange={setDate} />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setDate(null)} disabled={date === null}>
          Toate datele
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDate(todayIso())}>
          Azi
        </Button>

        <div className="w-44">
          <Select
            label="Județ"
            value={county}
            options={[{ value: ALL, label: 'Toate județele' }, ...COUNTY_OPTIONS]}
            onChange={setCounty}
          />
        </div>

        <div className="w-48">
          <Select
            label="Șofer"
            value={driver}
            options={[
              { value: ALL, label: 'Toți șoferii' },
              { value: NO_DRIVER, label: 'Fără șofer' },
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
            placeholder="rută, județ, șofer, client…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Toolbar>

      <div className="flex min-h-0 flex-1">
        {/* ---- routes ------------------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-border">
          {routesQuery.error ? (
            <ErrorBlock error={routesQuery.error} onRetry={() => void routesQuery.refetch()} />
          ) : (
            <DataTable
              rows={filteredRoutes}
              columns={columns}
              rowKey={(route) => route.id}
              initialSort={{ key: 'date', dir: 'asc' }}
              loading={routesQuery.isPending}
              activeKey={selectedRouteId}
              onRowClick={(route) => setSelectedRouteId(route.id)}
              empty={
                <EmptyState
                  title={filtersActive ? 'Nicio rută pentru filtrele curente' : 'Nicio rută'}
                  body={
                    filtersActive
                      ? 'Ajustează filtrele sau resetează-le.'
                      : 'Creează prima rută pentru a începe planificarea.'
                  }
                  action={
                    filtersActive ? (
                      <Button variant="secondary" size="sm" onClick={resetFilters}>
                        Resetează filtrele
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                        Rută nouă
                      </Button>
                    )
                  }
                />
              }
            />
          )}
        </div>

        {/* ---- dispatch board ----------------------------------------- */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToWindowEdges]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggedTask(null)}
        >
          <section className="flex w-96 shrink-0 flex-col border-r border-border">
            <PanelHeader
              title={selectedRoute ? routeLabel(selectedRoute) : 'Nicio rută selectată'}
              subtitle={
                selectedRoute
                  ? `${formatDate(selectedRoute.date)} · ${weekdayLabel(selectedRoute.dayOfWeek)} · ${driverLabel(selectedRoute.employee)} · ${selectedProgress.done}/${selectedProgress.total} finalizate`
                  : 'Alege o rută din tabel'
              }
              actions={
                selectedRoute && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setDriverPickerOpen(true)}>
                      Șofer
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRecurringOpen(true)}>
                      + Recurente
                    </Button>
                  </>
                )
              }
            />

            <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken">
              {!selectedRoute ? (
                <EmptyState
                  title="Selectează o rută"
                  body="Sarcinile rutei apar aici, în ordinea de execuție."
                />
              ) : (
                <AsyncPanel
                  isPending={routeTasksQuery.isPending}
                  error={routeTasksQuery.error}
                  onRetry={() => void routeTasksQuery.refetch()}
                  loadingLabel="Se încarcă sarcinile rutei…"
                >
                  <RouteDropZone>
                    <SortableContext items={routeTaskIds} strategy={verticalListSortingStrategy}>
                      <div className="flex flex-col gap-1.5">
                        {routeTasks.map((task, index) => (
                          <SortableRouteTask
                            key={task.id}
                            task={task}
                            position={index + 1}
                            onOpen={() => setOpenTaskId(task.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>

                    {routeTasks.length === 0 && (
                      <p className="px-2 py-10 text-center text-sm text-ink-muted">
                        Nicio sarcină pe această rută. Trage sarcini din coloana din dreapta.
                      </p>
                    )}
                  </RouteDropZone>
                </AsyncPanel>
              )}
            </div>
          </section>

          {/* ---- unassigned queue ------------------------------------ */}
          <section className="flex w-80 shrink-0 flex-col">
            <PanelHeader
              title="Neasignate"
              subtitle={`${unassignedTasks.length} sarcini fără rută`}
            />
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken p-2">
              <AsyncPanel
                isPending={tasksQuery.isPending}
                error={tasksQuery.error}
                isEmpty={unassignedTasks.length === 0}
                emptyTitle={query ? 'Niciun rezultat pentru căutarea curentă' : 'Nimic de repartizat'}
                emptyBody={query ? 'Golește căutarea din bara de sus.' : 'Toate sarcinile au o rută.'}
                onRetry={() => void tasksQuery.refetch()}
              >
                <div className="flex flex-col gap-1.5">
                  {unassignedTasks.map((task) => (
                    <div key={task.id} className="group relative">
                      <DraggablePoolTask task={task} onOpen={() => setOpenTaskId(task.id)} />
                      {/* Keyboard/precision fallback for the drag gesture. */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        onClick={() => setPoolTargetTask(task)}
                      >
                        Asignează
                      </Button>
                    </div>
                  ))}
                </div>
              </AsyncPanel>
            </div>
          </section>

          <DragOverlay>
            {draggedTask ? <DispatchTaskCard task={draggedTask} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ---- overlays --------------------------------------------------- */}
      <RouteFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        submitting={createRoute.isPending}
        drivers={driversQuery.data}
        defaultDate={date}
        onSubmit={(input) =>
          createRoute.mutate(input, {
            onSuccess: (route) => {
              toast.success(`Ruta „${routeLabel(route)}” a fost creată.`);
              setCreateOpen(false);
              setSelectedRouteId(route.id);
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      />

      <DriverPickerModal
        open={driverPickerOpen}
        onClose={() => setDriverPickerOpen(false)}
        subtitle={selectedRoute ? `Rută: ${routeLabel(selectedRoute)}` : undefined}
        drivers={driversQuery.data}
        isPending={driversQuery.isPending}
        error={driversQuery.error}
        currentDriverId={selectedRoute?.employee?.id ?? null}
        busy={assignDriver.isPending}
        onSelect={(employee) => {
          if (!selectedRoute) return;
          assignDriver.mutate(
            { routeId: selectedRoute.id, employeeId: employee.id },
            {
              onSuccess: () => {
                toast.success(
                  `${employee.fullName} a fost asignat pe ${routeLabel(selectedRoute)}.`,
                );
                setDriverPickerOpen(false);
              },
              onError: (error) => toast.error(errorMessage(error)),
            },
          );
        }}
      />

      <AssignRecurringModal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        route={selectedRoute}
      />

      <RoutePickerModal
        open={poolTargetTask !== null}
        onClose={() => setPoolTargetTask(null)}
        title="Asignează sarcina pe rută"
        subtitle={
          poolTargetTask
            ? `${poolTargetTask.clientName ?? 'Client necunoscut'} — ${poolTargetTask.address ?? 'fără adresă'}`
            : undefined
        }
        routes={routes}
        isPending={routesQuery.isPending}
        error={routesQuery.error}
        busy={reassignTasks.isPending}
        onSelect={(route) => {
          const task = poolTargetTask;
          if (!task) return;
          reassignTasks.mutate(
            { taskIds: [task.id], routeId: route.id },
            {
              onSuccess: () => {
                toast.success(`Sarcina a fost adăugată pe ${routeLabel(route)}.`);
                setSelectedRouteId(route.id);
                setPoolTargetTask(null);
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
