/**
 * Rute — the dispatch board.
 *
 * Three panes on one screen, which is the whole point of moving off the phone:
 *   left    every route for the week, filterable by county/driver, with live
 *           progress — scrolls vertically only, never sideways
 *   middle  the selected route's stops in execution order (drag to reorder)
 *   right   the unassigned queue, dragged directly onto the route
 *
 * Reordering persists through `api.routes.reorderTasks(routeId, taskIds)` —
 * a bare ordered array of ids — and is applied optimistically so the list never
 * snaps back while the request is in flight.
 *
 * Above the stop list sits the one local suggestion left in `./grouping.ts`:
 * a shorter stop order. It is a proposal with its numbers on show — nothing is
 * reordered until the dispatcher accepts. (The "Grupare sugerată" card that
 * proposed unassigned jobs for the route was removed — TODO-16.)
 *
 * `?ruta=<id>` selects a route and `?nou=1` opens the create form, which is how
 * the command palette (⌘K) lands here.
 */

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { CommandBar, ToolbarSeparator, Workbench } from '@/components/layout';
import {
  Button,
  DataTable,
  EmptyState,
  IconButton,
  Select,
  Tabs,
  TextInput,
  cx,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { weekdayLabel } from '@/components/domain';
import type { Route, Task } from '@/types/domain';
import { useDeepLink, useDeepLinkOnce, useDeepLinkFlagOnce } from '@/lib/deepLink';
import { useShortcuts } from '@/lib/hotkeys';
import { useUndo } from '@/lib/undo';
import { recordUse } from '@/lib/recents';
import { matchesQuery } from '@/lib/search';
import {
  useAssignDriver,
  useAssignTasksToRoute,
  useCreateRoute,
  useDeleteRoute,
  useDrivers,
  useMoveTaskToRoute,
  useReorderRouteTasks,
  useReassignTasks,
  useRouteTasks,
  useRoutes,
  useTasks,
  useTaskUndoActions,
} from './queries';
import {
  driverLabel,
  errorMessage,
  isUnassigned,
  routeLabel,
  sortByOrderIndex,
  taskProgress,
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
import {
  HeldTray,
  InsertionSlot,
  PlacementProvider,
  insertAtSlot,
  moveToSlot,
  readSlotIndex,
  usePlacement,
} from './components/placement';
import { DriverPickerModal, RoutePickerModal } from './components/pickers';
import { DispatchSuggestions } from './components/suggestions';

type BoardPane = 'routes' | 'stops' | 'pool';

export function RoutesPage() {
  return (
    <FeedbackProvider>
      <PlacementProvider>
        <RoutesScreen />
      </PlacementProvider>
    </FeedbackProvider>
  );
}

const NO_DRIVER = 'NONE';
/** DOM id so the "/" shortcut can put the cursor in the search box. */
const SEARCH_FIELD_ID = 'routes-search';

function RoutesScreen() {
  const { toast, confirm } = useFeedback();

  // --- filters -------------------------------------------------------------
  const [county, setCounty] = useState<string>(ALL);
  const [driver, setDriver] = useState<string>(ALL);
  const [query, setQuery] = useState('');

  // --- selection & overlays ------------------------------------------------
  const [storedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  /** Which board column is on screen below `lg`; ignored at desktop width. */
  const [board, setBoard] = useState<BoardPane>('routes');
  const [driverPickerOpen, setDriverPickerOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  // TODO-05: moving a stop off this route and onto another driver's route —
  // the cover-a-sick-day case. Route-level driver swap is the other half and
  // lives on the driver name in the routes table.
  const [moveTargetTask, setMoveTargetTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  // --- server state --------------------------------------------------------
  const routesQuery = useRoutes();
  const driversQuery = useDrivers();
  const tasksQuery = useTasks();

  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);

  const filteredRoutes = useMemo(
    () =>
      routes.filter((route) => {
        if (county !== ALL && route.county !== county) return false;
        if (driver === NO_DRIVER && route.employee) return false;
        if (driver !== ALL && driver !== NO_DRIVER && String(route.employee?.id) !== driver) {
          return false;
        }
        return matchesQuery(query, routeLabel(route), route.county, route.employee?.fullName);
      }),
    [routes, county, driver, query],
  );

  // Keep a route selected whenever the filtered list has one to show —
  // DERIVED, not corrected in an effect (TODO-26).
  //
  // "Which route is selected" is a question about the filtered list, so it is
  // answered from the filtered list: the stored id while that route is still
  // visible, otherwise the first row, otherwise nothing. Typing in the filter
  // used to leave one render in which `selectedRouteId` still pointed at a route
  // that had just been filtered out — long enough for `useRouteTasks` to fetch
  // that route's tasks and for the detail pane to render them beside a list the
  // route is no longer in.
  const selectedRouteId =
    storedRouteId !== null && filteredRoutes.some((route) => route.id === storedRouteId)
      ? storedRouteId
      : (filteredRoutes[0]?.id ?? null);

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
  const undoStack = useUndo();
  const undoActions = useTaskUndoActions();
  const placement = usePlacement();
  const reorderTasks = useReorderRouteTasks(selectedRouteId ?? -1);
  const moveTask = useMoveTaskToRoute(selectedRoute);
  const reassignTasks = useReassignTasks();
  const assignGroup = useAssignTasksToRoute(selectedRouteId ?? -1);

  // --- deep links & shortcuts ----------------------------------------------
  useDeepLinkOnce('ruta', useDeepLink().number('ruta'), (routeId) => {
    setSelectedRouteId(routeId);
    recordUse('route', routeId);
  });

  useDeepLinkFlagOnce('nou', () => setCreateOpen(true));

  useShortcuts([
    {
      combo: 'n',
      description: 'Rută nouă',
      group: 'Rute',
      run: () => setCreateOpen(true),
    },
    {
      combo: '/',
      description: 'Focus pe câmpul de căutare',
      group: 'Rute',
      run: () => document.getElementById(SEARCH_FIELD_ID)?.focus(),
    },
    {
      combo: 'd',
      description: 'Alege șoferul rutei selectate',
      group: 'Rute',
      disabled: selectedRouteId === null,
      run: () => setDriverPickerOpen(true),
    },
  ]);

  // --- drag and drop -------------------------------------------------------
  /**
   * Only count a droppable the pointer is ACTUALLY over.
   *
   * This replaces `closestCenter`, which caused a real bug: it returns the
   * nearest droppable regardless of where the pointer is, so picking a task
   * out of "Neasignate", nudging it a few pixels and dropping it back still
   * resolved to a drop target — and the task silently landed on the route, at
   * whichever slot happened to be closest. There was no way to "pick up and
   * change your mind".
   *
   * `pointerWithin` requires genuine containment; `rectIntersection` is the
   * fallback for the trailing band below the last stop, where the pointer can
   * sit outside every rect while the dragged card still overlaps one. When
   * neither matches, `over` is null and handleDragEnd returns without writing
   * anything — which is exactly what dropping in dead space should do.
   */
  const collisionDetection: CollisionDetection = (args) => {
    const withinPointer = pointerWithin(args);
    return withinPointer.length > 0 ? withinPointer : rectIntersection(args);
  };

  const sensors = useSensors(
    // A small threshold keeps plain clicks (open the drawer) working.
    // 8px, not 5: the gesture that starts a drag has to be deliberate, or a
    // click that wobbles turns into an assignment.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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
    const overSlot = readSlotIndex(over.id);

    if (payload.container === 'route') {
      const from = routeTaskIds.indexOf(payload.taskId);
      if (from < 0) return;

      // Dropped on an insertion band: the band's index counts positions in the
      // CURRENT list, so removing the dragged stop first shifts every band
      // after it down by one.
      if (overSlot !== null) {
        const previousOrder = [...routeTaskIds];
        const next = moveToSlot(routeTaskIds, from, overSlot);
        if (next.every((id, i) => id === previousOrder[i])) return;
        reorderTasks.mutate(next, {
          onSuccess: () =>
            undoStack.push({
              label: `reordonarea opririlor pe ${routeLabel(selectedRoute)}`,
              invert: () => undoActions.restoreOrder(selectedRoute.id, previousOrder),
            }),
          onError: (error) => toast.error(errorMessage(error)),
        });
        return;
      }

      if (overTaskId === null) return; // dropped on the empty zone, order unchanged
      const to = routeTaskIds.indexOf(overTaskId);
      if (to < 0 || from === to) return;

      // Snapshot before the write — after it lands the cache holds the new
      // order and the old one is unrecoverable.
      const previousOrder = [...routeTaskIds];
      reorderTasks.mutate(arrayMove(routeTaskIds, from, to), {
        onSuccess: () =>
          undoStack.push({
            label: `reordonarea opririlor pe ${routeLabel(selectedRoute)}`,
            invert: () => undoActions.restoreOrder(selectedRoute.id, previousOrder),
          }),
        onError: (error) => toast.error(errorMessage(error)),
      });
      return;
    }

    // Unassigned → route. `over` is either a stop (insert before it) or the
    // drop zone itself (append at the end).
    if (over.id !== ROUTE_DROP_ID && overTaskId === null && overSlot === null) return;
    const task = unassignedTasks.find((item) => item.id === payload.taskId);
    if (!task) return;

    // The drop target has to be a REAL position on this route. A stop id that
    // is not on the route means the pointer was over another unassigned card,
    // which is not an assignment — silently appending it to the end is how a
    // task used to land "somewhere" the dispatcher never chose.
    const overIndex = overTaskId === null ? null : routeTaskIds.indexOf(overTaskId);
    if (overIndex !== null && overIndex < 0) return;

    const insertAt =
      overSlot !== null ? overSlot : overIndex === null ? routeTaskIds.length : overIndex;
    const orderedIds = [...routeTaskIds];
    orderedIds.splice(insertAt, 0, task.id);

    moveTask.mutate(
      { task, orderedIds },
      {
        onSuccess: () =>
          toast.success(`Sarcina a fost adăugată pe ${routeLabel(selectedRoute)}.`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  /**
   * Second half of the pick-up gesture: everything currently held drops in at
   * `index`, in the order it was picked up. One `assignGroup` call, not one per
   * task — the backend reassigns the batch and renumbers the whole route once.
   */
  const handlePlace = (index: number) => {
    if (!selectedRoute || placement.held.length === 0) return;
    const heldIds = placement.held.map((task) => task.id);
    const orderedIds = insertAtSlot(routeTaskIds, heldIds, index);

    assignGroup.mutate(
      { taskIds: heldIds, orderedIds },
      {
        onSuccess: () => {
          toast.success(
            heldIds.length === 1
              ? `Sarcina a fost adăugată pe ${routeLabel(selectedRoute)}.`
              : `${heldIds.length} sarcini au fost adăugate pe ${routeLabel(selectedRoute)}.`,
          );
          placement.clear();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  useShortcuts([
    {
      combo: 'escape',
      description: 'Renunță la sarcinile ridicate',
      group: 'Rute',
      // Registered only while something is held, so Escape keeps closing
      // drawers and modals the rest of the time.
      disabled: !placement.active,
      run: () => placement.clear(),
    },
  ]);

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
      key: 'day',
      header: 'Ziua',
      width: '7rem',
      sortValue: (route) => route.dayOfWeek ?? 8,
      render: (route) => <span className="block">{weekdayLabel(route.dayOfWeek)}</span>,
    },
    {
      // The driver's NAME is the control: clicking it opens the picker. There
      // is no separate "Șofer" action button any more — one thing, one place.
      key: 'driver',
      header: 'Șofer',
      width: '11rem',
      sortValue: (route) => route.employee?.fullName ?? null,
      render: (route) => (
        <button
          type="button"
          className={
            route.employee
              ? 'truncate text-left underline-offset-2 hover:underline'
              : 'truncate text-left text-warning-700 underline-offset-2 hover:underline'
          }
          onClick={(event) => {
            event.stopPropagation();
            setSelectedRouteId(route.id);
            setDriverPickerOpen(true);
          }}
        >
          {driverLabel(route.employee)}
        </button>
      ),
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
      width: '3.5rem',
      align: 'right',
      render: (route) => (
        <span className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <IconButton label="Șterge ruta" onClick={() => void handleDelete(route)}>
            ✕
          </IconButton>
        </span>
      ),
    },
  ];

  const selectedProgress = taskProgress(routeTasks);
  const filtersActive = county !== ALL || driver !== ALL || query !== '';
  const resetFilters = () => {
    setCounty(ALL);
    setDriver(ALL);
    setQuery('');
  };

  return (
    <Workbench>
      <CommandBar
        title="Rute"
        subtitle={
          routesQuery.isPending
            ? 'Se încarcă…'
            : `${filteredRoutes.length} din ${routes.length} rute · ${unassignedTasks.length} sarcini neasignate`
        }
        tools={
          <>
            <div className="hidden w-56 md:block xl:w-72">
              <TextInput
                id={SEARCH_FIELD_ID}
                placeholder="rută, județ, șofer, client…  ( / )"
                value={query}
                inputSize="sm"
                clearable
                onClear={() => setQuery('')}
                onChange={(event) => setQuery(event.target.value)}
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
              onClick={() => setCreateOpen(true)}
            >
              Rută nouă
            </Button>
            <ToolbarSeparator />
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw aria-hidden />}
              loading={routesQuery.isFetching}
              onClick={() => void routesQuery.refetch()}
            >
              Reîmprospătează
            </Button>
          </>
        }
        tabs={
          // The board is three columns side by side on a wide screen. Below
          // `lg` they become one column at a time — a 390px viewport cannot
          // show a table, a route and a queue at once, and shrinking all three
          // gives three unusable columns instead of one good one.
          <div className="lg:hidden">
            <Tabs
              items={[
                { id: 'routes', label: 'Rute', count: filteredRoutes.length },
                { id: 'stops', label: 'Opriri', count: routeTasks.length },
                { id: 'pool', label: 'Neasignate', count: unassignedTasks.length },
              ]}
              active={board}
              onChange={(id) => setBoard(id as BoardPane)}
            />
          </div>
        }
      />

      {showFilters && (
        <Toolbar>
          <div className="w-full sm:hidden">
            <TextInput
              label="Căutare"
              placeholder="rută, județ, șofer, client…"
              value={query}
              inputSize="sm"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              label="Județ"
              value={county}
              size="sm"
              options={[{ value: ALL, label: 'Toate județele' }, ...COUNTY_OPTIONS]}
              onChange={setCounty}
            />
          </div>

          <div className="w-48">
            <Select
              label="Șofer"
              value={driver}
              size="sm"
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
        </Toolbar>
      )}

      <div className="flex min-h-0 flex-1">
        {/* ---- routes ------------------------------------------------- */}
        <div
          className={cx(
            'min-w-0 flex-1 flex-col border-r border-border lg:flex',
            board === 'routes' ? 'flex' : 'hidden',
          )}
        >
          {routesQuery.error ? (
            <ErrorBlock error={routesQuery.error} onRetry={() => void routesQuery.refetch()} />
          ) : (
            <DataTable
              rows={filteredRoutes}
              columns={columns}
              rowKey={(route) => route.id}
              initialSort={{ key: 'day', dir: 'asc' }}
              loading={routesQuery.isPending}
              activeKey={selectedRouteId}
              onRowClick={(route) => {
                recordUse('route', route.id);
                setSelectedRouteId(route.id);
              }}
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
          collisionDetection={collisionDetection}
          modifiers={[restrictToWindowEdges]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggedTask(null)}
        >
          <section
            className={cx(
              'w-full flex-col border-r border-border lg:flex lg:w-96 lg:shrink-0',
              board === 'stops' ? 'flex' : 'hidden',
            )}
          >
            <PanelHeader
              title={selectedRoute ? routeLabel(selectedRoute) : 'Nicio rută selectată'}
              subtitle={
                selectedRoute
                  ? `${weekdayLabel(selectedRoute.dayOfWeek)} · ${driverLabel(selectedRoute.employee)} · ${selectedProgress.done}/${selectedProgress.total} finalizate`
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

            {selectedRoute && !routeTasksQuery.isPending && (
              <DispatchSuggestions
                route={selectedRoute}
                routeTasks={routeTasks}
                busy={reorderTasks.isPending}
                onApplyOrder={(orderedIds) =>
                  reorderTasks.mutate(orderedIds, {
                    onSuccess: () => toast.success('Ordinea opririlor a fost actualizată.'),
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
              />
            )}

            {selectedRoute && <HeldTray onCancel={placement.clear} />}

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
                      <div className="flex flex-col">
                        {routeTasks.map((task, index) => (
                          <div key={task.id}>
                            <InsertionSlot
                              index={index}
                              count={placement.held.length}
                              onPlace={handlePlace}
                              disabled={assignGroup.isPending}
                            />
                            <div className="group relative">
                              <SortableRouteTask
                                task={task}
                                position={index + 1}
                                onOpen={() => setOpenTaskId(task.id)}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setMoveTargetTask(task);
                                }}
                              >
                                Mută
                              </Button>
                            </div>
                          </div>
                        ))}
                        {/* Trailing band: append after the last stop. */}
                        <InsertionSlot
                          index={routeTasks.length}
                          count={placement.held.length}
                          onPlace={handlePlace}
                          disabled={assignGroup.isPending}
                        />
                      </div>
                    </SortableContext>

                    {routeTasks.length === 0 && !placement.active && (
                      <p className="px-2 py-10 text-center text-sm text-ink-muted">
                        Nicio sarcină pe această rută. Alege sarcini din dreapta, apoi apasă unde
                        să intre — sau trage-le direct.
                      </p>
                    )}
                  </RouteDropZone>
                </AsyncPanel>
              )}
            </div>
          </section>

          {/* ---- unassigned queue ------------------------------------ */}
          <section
            className={cx(
              'w-full flex-col lg:flex lg:w-80 lg:shrink-0',
              board === 'pool' ? 'flex' : 'hidden',
            )}
          >
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
                      <DraggablePoolTask
                        task={task}
                        onOpen={() => setOpenTaskId(task.id)}
                        held={placement.isHeld(task.id)}
                        onToggleHold={selectedRoute ? () => placement.toggle(task) : undefined}
                      />
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
        open={moveTargetTask !== null}
        onClose={() => setMoveTargetTask(null)}
        title="Mută sarcina pe altă rută"
        subtitle={
          moveTargetTask
            ? `${moveTargetTask.clientName ?? 'Client necunoscut'} — ${moveTargetTask.address ?? 'fără adresă'}`
            : undefined
        }
        // Excluding the current route: "move it to where it already is" is not
        // an option worth offering.
        routes={routes.filter((route) => route.id !== selectedRouteId)}
        isPending={routesQuery.isPending}
        error={routesQuery.error}
        busy={reassignTasks.isPending}
        onSelect={(route) => {
          const task = moveTargetTask;
          if (!task) return;
          reassignTasks.mutate(
            { taskIds: [task.id], routeId: route.id },
            {
              onSuccess: () => {
                toast.success(`Sarcina a fost mutată pe ${routeLabel(route)}.`);
                setMoveTargetTask(null);
              },
              onError: (error) => toast.error(errorMessage(error)),
            },
          );
        }}
      />


      <TaskDetailDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </Workbench>
  );
}
