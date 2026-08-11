/**
 * Inline table-cell editors.
 *
 * Each cell owns its own mutation so the pending state is per-row rather than
 * per-table, and each stops click propagation so editing never triggers the
 * row's own "open the drawer" handler.
 */

import type { ReactNode } from 'react';
import { DateInput, Select } from '@/components/ui';
import type { Task, TaskStatus } from '@/types/domain';
import { useUpdateTaskDate, useUpdateTaskStatus } from '../queries';
import { errorMessage, taskDate } from '../utils';
import { TASK_STATUS_OPTIONS } from '../constants';
import { useFeedback } from './feedback';

function CellShell({ width, children }: { width: string; children: ReactNode }) {
  return (
    <div
      style={{ width }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function InlineStatusSelect({ task }: { task: Task }) {
  const { toast } = useFeedback();
  const mutation = useUpdateTaskStatus();

  return (
    <CellShell width="8.5rem">
      <Select
        value={task.status}
        options={TASK_STATUS_OPTIONS}
        disabled={mutation.isPending}
        onChange={(value) =>
          mutation.mutate(
            { taskId: task.id, status: value as TaskStatus },
            {
              onSuccess: () => toast.success('Status actualizat.'),
              onError: (error) => toast.error(errorMessage(error)),
            },
          )
        }
      />
    </CellShell>
  );
}

export function InlineDateInput({ task }: { task: Task }) {
  const { toast } = useFeedback();
  const mutation = useUpdateTaskDate();

  return (
    <CellShell width="9.5rem">
      <DateInput
        value={taskDate(task)}
        disabled={mutation.isPending}
        onChange={(value) => {
          if (!value) return;
          mutation.mutate(
            { taskId: task.id, date: value },
            {
              // The backend pins the time to 08:00 on the chosen day.
              onSuccess: () => toast.success('Dată reprogramată (ora 08:00).'),
              onError: (error) => toast.error(errorMessage(error)),
            },
          );
        }}
      />
    </CellShell>
  );
}
