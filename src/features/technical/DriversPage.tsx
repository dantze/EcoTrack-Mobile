/**
 * Șoferi — the driver roster with route assignments and daily workload.
 *
 * Replaces the mobile RoutesAndDrivers → DriverRoutesList drill-down: the
 * table answers "who is overloaded today" at a glance and the drawer holds the
 * per-driver detail that used to be a separate screen.
 *
 * Employee create/edit/delete go through /api/admin/**, which requires the
 * admin role on the caller's Bearer token. A 401/403 from those is reported
 * as a clear Romanian message instead of bubbling out.
 */

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  DateInput,
  Drawer,
  EmptyState,
  PageHeader,
  Select,
  TextInput,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { ROLE_LABELS, formatDate, weekdayLabel } from '@/components/domain';
import type { CreateEmployeeInput } from '@/api';
import type { Employee, Task } from '@/types/domain';
import {
  useCreateEmployee,
  useDeleteEmployee,
  useDriverRoutes,
  useDriverTasks,
  useDrivers,
  useTasks,
  useUpdateEmployee,
} from './queries';
import {
  errorMessage,
  isAdminAuthError,
  matchesQuery,
  routeLabel,
  shiftIsoDate,
  taskDate,
  taskProgress,
  todayIso,
} from './utils';
import { ALL, COUNTY_OPTIONS } from './constants';
import {
  AsyncPanel,
  DetailList,
  DetailRow,
  ErrorBlock,
  ProgressMeter,
  Toolbar,
} from './components/display';
import { EmployeeFormModal } from './components/EmployeeFormModal';
import { FeedbackProvider, useFeedback } from './components/feedback';

export function DriversPage() {
  return (
    <FeedbackProvider>
      <DriversScreen />
    </FeedbackProvider>
  );
}

/** How many days of workload the drawer projects forward. */
const WORKLOAD_DAYS = 7;

function DriversScreen() {
  const { toast, confirm } = useFeedback();

  const [query, setQuery] = useState('');
  const [county, setCounty] = useState<string>(ALL);
  const [day, setDay] = useState<string>(todayIso());
  const [openDriverId, setOpenDriverId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const driversQuery = useDrivers();
  const tasksQuery = useTasks();

  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const drivers = useMemo(() => driversQuery.data ?? [], [driversQuery.data]);

  /** Tasks grouped by the driver that owns their route. */
  const tasksByDriver = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const task of tasksQuery.data ?? []) {
      const driverId = task.route?.employee?.id;
      if (driverId === undefined) continue;
      const bucket = map.get(driverId);
      if (bucket) bucket.push(task);
      else map.set(driverId, [task]);
    }
    return map;
  }, [tasksQuery.data]);

  const routesByDriver = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const task of tasksQuery.data ?? []) {
      const driverId = task.route?.employee?.id;
      if (driverId === undefined || !task.route) continue;
      const bucket = map.get(driverId) ?? new Set<number>();
      bucket.add(task.route.id);
      map.set(driverId, bucket);
    }
    return map;
  }, [tasksQuery.data]);

  const filtered = useMemo(
    () =>
      drivers.filter((driver) => {
        if (county !== ALL && driver.county !== county) return false;
        return matchesQuery(query, driver.fullName, driver.username, driver.phone, driver.county);
      }),
    [drivers, county, query],
  );

  const filtersActive = county !== ALL || query !== '';
  const resetFilters = () => {
    setCounty(ALL);
    setQuery('');
  };

  const openDriver = useMemo(
    () => drivers.find((driver) => driver.id === openDriverId) ?? null,
    [drivers, openDriverId],
  );

  const dayTasksFor = (driverId: number): Task[] =>
    (tasksByDriver.get(driverId) ?? []).filter((task) => taskDate(task) === day);

  const handleDelete = async (employee: Employee) => {
    const ok = await confirm({
      title: 'Șterge angajatul',
      body: `Ștergi contul „${employee.fullName}”? Rutele rămân, dar fără șofer.`,
      confirmLabel: 'Șterge',
      destructive: true,
    });
    if (!ok) return;

    deleteEmployee.mutate(employee.id, {
      onSuccess: () => {
        toast.success(`${employee.fullName} a fost șters.`);
        if (openDriverId === employee.id) setOpenDriverId(null);
      },
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Șofer',
      sortValue: (driver) => driver.fullName,
      render: (driver) => (
        <span className="block">
          <span className="block truncate font-medium text-ink">{driver.fullName}</span>
          <span className="block truncate text-xs text-ink-subtle">@{driver.username}</span>
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Telefon',
      width: '9rem',
      sortValue: (driver) => driver.phone,
      render: (driver) => <span className="tabular">{driver.phone ?? '—'}</span>,
    },
    {
      key: 'county',
      header: 'Județ',
      width: '9rem',
      sortValue: (driver) => driver.county,
      render: (driver) => driver.county ?? '—',
    },
    {
      key: 'roles',
      header: 'Roluri',
      width: '10rem',
      render: (driver) => (
        <span className="flex flex-wrap gap-1">
          {driver.roles.map((role) => (
            <Badge key={role} tone={role === 'DRIVER' ? 'info' : 'neutral'}>
              {ROLE_LABELS[role]}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'routes',
      header: 'Rute',
      width: '5rem',
      align: 'right',
      sortValue: (driver) => routesByDriver.get(driver.id)?.size ?? 0,
      render: (driver) => (
        <span className="tabular">{routesByDriver.get(driver.id)?.size ?? 0}</span>
      ),
    },
    {
      key: 'dayLoad',
      header: 'Sarcini în ziua aleasă',
      width: '12rem',
      sortValue: (driver) => dayTasksFor(driver.id).length,
      render: (driver) => {
        const dayTasks = dayTasksFor(driver.id);
        if (dayTasks.length === 0) {
          return <span className="text-xs text-ink-subtle">liber</span>;
        }
        return <ProgressMeter progress={taskProgress(dayTasks)} />;
      },
    },
    {
      key: 'total',
      header: 'Total sarcini',
      width: '7rem',
      align: 'right',
      sortValue: (driver) => tasksByDriver.get(driver.id)?.length ?? 0,
      render: (driver) => (
        <span className="tabular">{tasksByDriver.get(driver.id)?.length ?? 0}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '8rem',
      align: 'right',
      render: (driver) => (
        <span className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(driver);
              setFormOpen(true);
            }}
          >
            Editează
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleDelete(driver)}>
            Șterge
          </Button>
        </span>
      ),
    },
  ];

  const adminError =
    (createEmployee.error ?? updateEmployee.error ?? deleteEmployee.error) || null;

  return (
    <>
      <PageHeader
        title="Șoferi"
        subtitle={
          driversQuery.isPending
            ? 'Se încarcă…'
            : `${filtered.length} din ${drivers.length} șoferi · încărcare pentru ${formatDate(day)}`
        }
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Angajat nou
          </Button>
        }
      />

      {adminError !== null && isAdminAuthError(adminError) && (
        <div
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-800"
        >
          {errorMessage(adminError)}
        </div>
      )}

      <Toolbar>
        <div className="w-40">
          <DateInput
            label="Ziua analizată"
            value={day}
            onChange={(value) => setDay(value ?? todayIso())}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setDay(todayIso())}>
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

        <div className="w-56">
          <TextInput
            label="Căutare"
            placeholder="nume, utilizator, telefon…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Toolbar>

      {driversQuery.error ? (
        <ErrorBlock error={driversQuery.error} onRetry={() => void driversQuery.refetch()} />
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(driver) => driver.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          loading={driversQuery.isPending}
          activeKey={openDriverId}
          onRowClick={(driver) => setOpenDriverId(driver.id)}
          empty={
            <EmptyState
              title={filtersActive ? 'Niciun șofer pentru filtrele curente' : 'Niciun șofer'}
              body={
                filtersActive
                  ? 'Ajustează filtrele sau resetează-le.'
                  : 'Nu există încă angajați cu rolul de șofer.'
              }
              action={
                filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Resetează filtrele
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    Angajat nou
                  </Button>
                )
              }
            />
          }
        />
      )}

      <DriverDrawer
        driver={openDriver}
        day={day}
        onClose={() => setOpenDriverId(null)}
        onEdit={(driver) => {
          setEditing(driver);
          setFormOpen(true);
        }}
      />

      <EmployeeFormModal
        open={formOpen}
        employee={editing}
        submitting={createEmployee.isPending || updateEmployee.isPending}
        error={editing ? updateEmployee.error : createEmployee.error}
        onClose={() => {
          setFormOpen(false);
          createEmployee.reset();
          updateEmployee.reset();
        }}
        onSubmit={(input: CreateEmployeeInput, isEdit) => {
          if (isEdit && editing) {
            // An empty password box means "keep the current one".
            const { password, ...rest } = input;
            updateEmployee.mutate(
              { id: editing.id, input: password ? input : rest },
              {
                onSuccess: () => {
                  toast.success('Angajatul a fost actualizat.');
                  setFormOpen(false);
                },
                onError: (error) => toast.error(errorMessage(error)),
              },
            );
            return;
          }
          createEmployee.mutate(input, {
            onSuccess: (created) => {
              toast.success(`${created.fullName} a fost creat.`);
              setFormOpen(false);
            },
            onError: (error) => toast.error(errorMessage(error)),
          });
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

function DriverDrawer({
  driver,
  day,
  onClose,
  onEdit,
}: {
  driver: Employee | null;
  day: string;
  onClose: () => void;
  onEdit: (driver: Employee) => void;
}) {
  const routesQuery = useDriverRoutes(driver?.id ?? null);
  const tasksQuery = useDriverTasks(driver?.id ?? null);

  const workload = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    const days = Array.from({ length: WORKLOAD_DAYS }, (_, offset) => shiftIsoDate(day, offset));
    const rows = days.map((iso) => {
      const forDay = tasks.filter((task) => taskDate(task) === iso);
      return { iso, tasks: forDay, progress: taskProgress(forDay) };
    });
    const undated = tasks.filter((task) => taskDate(task) === null).length;
    const peak = rows.reduce((max, row) => Math.max(max, row.tasks.length), 0);
    return { rows, undated, peak };
  }, [tasksQuery.data, day]);

  return (
    <Drawer
      open={driver !== null}
      onClose={onClose}
      title={driver?.fullName ?? 'Șofer'}
      width="lg"
      footer={
        driver && (
          <Button variant="secondary" onClick={() => onEdit(driver)}>
            Editează angajatul
          </Button>
        )
      }
    >
      {driver && (
        <div className="flex flex-col gap-5">
          <section>
            <DetailList>
              <DetailRow label="Utilizator">@{driver.username}</DetailRow>
              <DetailRow label="Telefon">{driver.phone ?? '—'}</DetailRow>
              <DetailRow label="Județ">{driver.county ?? '—'}</DetailRow>
              <DetailRow label="Roluri">
                <span className="flex gap-1">
                  {driver.roles.map((role) => (
                    <Badge key={role} tone={role === 'DRIVER' ? 'info' : 'neutral'}>
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                </span>
              </DetailRow>
            </DetailList>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Rute asignate
            </h3>
            <AsyncPanel
              isPending={routesQuery.isPending}
              error={routesQuery.error}
              isEmpty={(routesQuery.data ?? []).length === 0}
              emptyTitle="Nicio rută"
              emptyBody="Acest șofer nu are rute asignate."
              onRetry={() => void routesQuery.refetch()}
            >
              <div className="flex flex-col gap-1.5">
                {(routesQuery.data ?? []).map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{routeLabel(route)}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {formatDate(route.date)} · {weekdayLabel(route.dayOfWeek)} ·{' '}
                        {route.county ?? 'fără județ'}
                      </p>
                    </div>
                    <ProgressMeter progress={taskProgress(route.tasks)} />
                  </div>
                ))}
              </div>
            </AsyncPanel>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Încărcare pe zile (din {formatDate(day)})
            </h3>
            <AsyncPanel
              isPending={tasksQuery.isPending}
              error={tasksQuery.error}
              onRetry={() => void tasksQuery.refetch()}
            >
              <div className="flex flex-col gap-1">
                {workload.rows.map((row) => (
                  <div key={row.iso} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2">
                    <span className="text-xs text-ink-muted">{formatDate(row.iso)}</span>
                    <span className="h-3 overflow-hidden rounded bg-surface-sunken">
                      <span
                        className="block h-full rounded bg-brand-500"
                        style={{
                          width:
                            workload.peak === 0
                              ? '0%'
                              : `${Math.round((row.tasks.length / workload.peak) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="tabular text-right text-xs text-ink-muted">
                      {row.progress.done}/{row.tasks.length}
                    </span>
                  </div>
                ))}
              </div>
              {workload.undated > 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  {workload.undated} sarcini fără dată programată.
                </p>
              )}
            </AsyncPanel>
          </section>
        </div>
      )}
    </Drawer>
  );
}
