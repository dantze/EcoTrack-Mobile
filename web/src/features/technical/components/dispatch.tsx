/**
 * Drag-and-drop building blocks for the dispatch board.
 *
 * Two containers share one DndContext on the Routes screen:
 *   'route' — the ordered task list of the selected route (sortable)
 *   'pool'  — unassigned tasks waiting to be dispatched (drag source only)
 *
 * Ids are kept distinct on purpose: route items use the numeric task id so
 * `arrayMove` can work on ids directly, pool items use a `pool-<id>` string so
 * the same task can never be ambiguous while it exists in both lists mid-drag.
 */

import type { CSSProperties, ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import type { Transform } from '@dnd-kit/utilities';
import type { Task } from '@/types/domain';
import { TaskStatusBadge, formatDate } from '@/components/domain';
import { TaskTypeBadge } from './display';
import { taskDate } from '../utils';

export const ROUTE_DROP_ID = 'route-drop-zone';

export type DragContainer = 'route' | 'pool';

export interface DragPayload {
  container: DragContainer;
  taskId: number;
}

/** dnd-kit hands back `Record<string, unknown> | undefined`; narrow it safely. */
export function readDragPayload(data: unknown): DragPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as { container?: unknown; taskId?: unknown };
  if (candidate.container !== 'route' && candidate.container !== 'pool') return null;
  if (typeof candidate.taskId !== 'number') return null;
  return { container: candidate.container, taskId: candidate.taskId };
}

export function poolItemId(taskId: number): string {
  return `pool-${taskId}`;
}

/** Same output as CSS.Translate.toString, without depending on @dnd-kit/utilities. */
function translate(transform: Transform | null): string | undefined {
  if (!transform) return undefined;
  return `translate3d(${transform.x}px, ${transform.y}px, 0)`;
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: Task;
  /** 1-based position, shown as the stop number on a route. */
  position?: number;
  onOpen?: () => void;
  dragging?: boolean;
  overlay?: boolean;
}

export function DispatchTaskCard({
  task,
  position,
  onOpen,
  dragging = false,
  overlay = false,
}: TaskCardProps) {
  return (
    <div
      className={[
        'rounded-md border bg-white px-2.5 py-2',
        overlay ? 'border-brand-500 shadow-lg' : 'border-border',
        dragging && !overlay ? 'opacity-40' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start gap-2">
        {position !== undefined && (
          <span className="tabular mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[0.6875rem] font-semibold text-white">
            {position}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            disabled={!onOpen}
            className="block w-full truncate text-left text-sm font-medium text-ink hover:underline disabled:cursor-default disabled:no-underline"
          >
            {task.clientName?.trim() ? task.clientName : 'Client necunoscut'}
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-1">
            <TaskTypeBadge type={task.type} />
            <TaskStatusBadge status={task.status} />
            <span className="tabular text-xs text-ink-subtle">{formatDate(taskDate(task))}</span>
          </div>

          <p className="mt-1 truncate text-xs text-ink-muted" title={task.address ?? undefined}>
            {task.address?.trim() ? task.address : 'Fără adresă'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable route item
// ---------------------------------------------------------------------------

export function SortableRouteTask({
  task,
  position,
  onOpen,
}: {
  task: Task;
  position: number;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { container: 'route', taskId: task.id } satisfies DragPayload,
  });

  const style: CSSProperties = { transform: translate(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab">
      <DispatchTaskCard task={task} position={position} onOpen={onOpen} dragging={isDragging} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draggable pool item
// ---------------------------------------------------------------------------

export function DraggablePoolTask({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: poolItemId(task.id),
    data: { container: 'pool', taskId: task.id } satisfies DragPayload,
  });

  const style: CSSProperties = { transform: translate(transform) };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab">
      <DispatchTaskCard task={task} onOpen={onOpen} dragging={isDragging} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop zone
// ---------------------------------------------------------------------------

export function RouteDropZone({
  disabled = false,
  children,
}: {
  disabled?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: ROUTE_DROP_ID, disabled });

  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-full rounded-md p-2 transition-colors',
        isOver && !disabled ? 'bg-brand-50 ring-1 ring-brand-500/40 ring-inset' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
