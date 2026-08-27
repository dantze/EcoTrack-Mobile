/**
 * Inline table-cell editors.
 *
 * Each cell owns its own mutation so the pending state is per-row rather than
 * per-table, and each stops click propagation so editing never triggers the
 * row's own "open the drawer" handler.
 *
 * There is deliberately no inline STATUS editor. Status belongs to the driver
 * — they mark "În curs" on arrival and the task completes when they finish
 * uploading photos — so the web renders it as a badge and never writes it.
 */

import type { ReactNode } from 'react';
import { DateInput } from '@/components/ui';
import type { Task } from '@/types/domain';
import { useUpdateTaskDate } from '../queries';
import { errorMessage, taskDate } from '../utils';
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
