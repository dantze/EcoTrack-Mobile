/**
 * Task detail as a side drawer — the desktop replacement for the mobile
 * ServiceDetails screen. Opened from both the dispatch board and the task
 * table, so it owns its own fetching (task + photos) and its own edits
 * (status, scheduled date, route) rather than taking them as props.
 */

import { useState } from 'react';
import { Button, DateInput, Drawer } from '@/components/ui';
import {
  ORDER_TYPE_LABELS,
  TASK_TYPE_LABELS,
  TaskStatusBadge,
  formatDate,
} from '@/components/domain';
import { clientName } from '@/types/domain';

import {
  useRoutes,
  useTask,
  useTaskPhotos,
  useUpdateTaskDate,
  useReassignTasks,
} from '../queries';
import {
  driverLabel,
  errorMessage,
  frequencyDetail,
  formatTime,
  routeLabel,
  taskDate,
} from '../utils';
import { PaneHeader } from '@/components/layout';
import { AsyncPanel, DetailList, DetailRow, LocationBlock, TaskTypeBadge } from './display';
import { RoutePickerModal } from './pickers';
import { useFeedback } from './feedback';

export interface TaskDetailDrawerProps {
  taskId: number | null;
  onClose: () => void;
}

/**
 * The task record itself, with no chrome around it.
 *
 * Rendered twice: inside the reading pane on `lg+`, and inside a Drawer below
 * it. One component so the two presentations cannot drift — the last time this
 * content existed in two places, only one of them learned that status is
 * read-only.
 */
function TaskDetailContent({ taskId }: { taskId: number | null }) {
  const { toast } = useFeedback();
  const [routePickerOpen, setRoutePickerOpen] = useState(false);

  const taskQuery = useTask(taskId);
  const photosQuery = useTaskPhotos(taskId);
  const routesQuery = useRoutes();

  const updateDate = useUpdateTaskDate();
  const reassign = useReassignTasks();

  const task = taskQuery.data ?? null;

  const handleDate = (value: string | null) => {
    if (!task || !value) return;
    updateDate.mutate(
      { taskId: task.id, date: value },
      {
        onSuccess: () => toast.success('Data programată a fost mutată (ora 08:00).'),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <>
      <AsyncPanel
          isPending={taskQuery.isPending}
          error={taskQuery.error}
          onRetry={() => void taskQuery.refetch()}
          loadingLabel="Se încarcă detaliile sarcinii…"
        >
          {task && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <TaskTypeBadge type={task.type} />
                <TaskStatusBadge status={task.status} />
                <span className="tabular text-xs text-ink-subtle">#{task.id}</span>
              </div>

              {/*
                Status is READ-ONLY here, deliberately.

                It is the driver's report from the field: they mark "În curs"
                when they arrive and the task completes when they finish
                uploading photos. A dispatcher setting it from the office would
                be recording work that may not have happened — so the web app
                observes status, it does not set it. The badge above shows the
                current value; the backend enforces the same rule
                (TaskAccessPolicy restricts PATCH /tasks/{id}/status to the
                assigned driver).
              */}
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface-sunken p-3">
                <DateInput
                  label="Dată programată"
                  hint="Serverul fixează ora la 08:00."
                  value={taskDate(task)}
                  disabled={updateDate.isPending}
                  onChange={handleDate}
                />
              </div>

              <section>
                <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Alocare
                </h3>
                <DetailList>
                  <DetailRow label="Rută">
                    <div className="flex items-center justify-between gap-2">
                      <span>{task.route ? routeLabel(task.route) : 'Neasignată'}</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRoutePickerOpen(true)}
                        loading={reassign.isPending}
                      >
                        {task.route ? 'Mută pe altă rută' : 'Asignează pe rută'}
                      </Button>
                    </div>
                  </DetailRow>
                  <DetailRow label="Șofer">{driverLabel(task.route?.employee)}</DetailRow>
                  <DetailRow label="Poziție pe rută">
                    {task.route ? `#${task.orderIndex + 1}` : '—'}
                  </DetailRow>
                  <DetailRow label="Oră programată">{formatTime(task.scheduledTime)}</DetailRow>
                </DetailList>
              </section>

              <section>
                <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Client și locație
                </h3>
                <DetailList>
                  <DetailRow label="Client">{task.clientName ?? '—'}</DetailRow>
                  <DetailRow label="Persoană contact">{task.contactPerson ?? '—'}</DetailRow>
                  <DetailRow label="Telefon">{task.clientPhone ?? '—'}</DetailRow>
                  <DetailRow label="Adresă">
                    {/* TODO(map): render these coordinates on a map pane. */}
                    <LocationBlock address={task.address} coordinates={task.coordinates} />
                  </DetailRow>
                </DetailList>
              </section>

              <section>
                <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Detalii lucrare
                </h3>
                <DetailList>
                  <DetailRow label="Tip">{TASK_TYPE_LABELS[task.type]}</DetailRow>
                  <DetailRow label="Produs">{task.productName ?? '—'}</DetailRow>
                  <DetailRow label="Cantitate">{task.quantity ?? '—'}</DetailRow>
                  <DetailRow label="Note interne">
                    <span className="whitespace-pre-wrap">{task.internalNotes ?? '—'}</span>
                  </DetailRow>
                </DetailList>
              </section>

              {task.order && (
                <section>
                  <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    Comandă sursă
                  </h3>
                  <DetailList>
                    <DetailRow label="Număr">#{task.order.number}</DetailRow>
                    <DetailRow label="Tip">{ORDER_TYPE_LABELS[task.order.orderType]}</DetailRow>
                    <DetailRow label="Dată">{formatDate(task.order.date)}</DetailRow>
                    <DetailRow label="Client">{clientName(task.order.client)}</DetailRow>
                    <DetailRow label="Observații">{task.order.details ?? '—'}</DetailRow>
                  </DetailList>
                </section>
              )}

              {task.recurringPlan && (
                <section>
                  <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    Plan recurent
                  </h3>
                  <DetailList>
                    <DetailRow label="Frecvență">
                      {frequencyDetail(task.recurringPlan.frequencyDays)}
                    </DetailRow>
                    <DetailRow label="Început">
                      {formatDate(task.recurringPlan.startDate)}
                    </DetailRow>
                    <DetailRow label="Ultima generare">
                      {formatDate(task.recurringPlan.lastGeneratedDate)}
                    </DetailRow>
                  </DetailList>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Poze ({photosQuery.data?.length ?? 0})
                </h3>
                <AsyncPanel
                  isPending={photosQuery.isPending}
                  error={photosQuery.error}
                  isEmpty={(photosQuery.data ?? []).length === 0}
                  emptyTitle="Nicio poză"
                  emptyBody="Șoferul nu a încărcat încă poze pentru această sarcină."
                  onRetry={() => void photosQuery.refetch()}
                  loadingLabel="Se încarcă pozele…"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {(photosQuery.data ?? []).map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-md border border-border"
                      >
                        <img
                          src={photo.url}
                          alt={`Poză sarcină ${task.id}`}
                          loading="lazy"
                          className="h-28 w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </AsyncPanel>
              </section>
            </div>
          )}
      </AsyncPanel>

      <RoutePickerModal
        open={routePickerOpen}
        onClose={() => setRoutePickerOpen(false)}
        title="Mută sarcina pe rută"
        subtitle={task ? `Sarcina #${task.id} — ${task.clientName ?? 'client necunoscut'}` : undefined}
        routes={routesQuery.data}
        isPending={routesQuery.isPending}
        error={routesQuery.error}
        excludeRouteId={task?.route?.id ?? null}
        busy={reassign.isPending}
        onSelect={(route) => {
          if (!task) return;
          reassign.mutate(
            { taskIds: [task.id], routeId: route.id },
            {
              onSuccess: () => {
                toast.success(`Sarcina a fost mutată pe ${routeLabel(route)}.`);
                setRoutePickerOpen(false);
              },
              onError: (error) => toast.error(errorMessage(error)),
            },
          );
        }}
      />
    </>
  );
}

/**
 * The reading pane: the task beside the list, not over it.
 *
 * Its title bar carries the client and the task id, because in a pane there is
 * no dialog heading above to say which record you are looking at.
 */
export function TaskDetailPane({ taskId, onClose }: TaskDetailDrawerProps) {
  const taskQuery = useTask(taskId);
  const task = taskQuery.data ?? null;

  if (taskId === null) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        title={task ? (task.clientName ?? 'Sarcină') : 'Sarcină'}
        subtitle={task ? `#${task.id} · ${TASK_TYPE_LABELS[task.type]}` : undefined}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <TaskDetailContent taskId={taskId} />
      </div>
    </div>
  );
}

/** Standalone slide-over, for a caller with no reading pane to render into. */
export function TaskDetailDrawer({ taskId, onClose }: TaskDetailDrawerProps) {
  const taskQuery = useTask(taskId);
  const task = taskQuery.data ?? null;

  return (
    <Drawer
      open={taskId !== null}
      onClose={onClose}
      title={task ? (task.clientName ?? 'Sarcină') : 'Sarcină'}
      width="lg"
    >
      <TaskDetailContent taskId={taskId} />
    </Drawer>
  );
}
