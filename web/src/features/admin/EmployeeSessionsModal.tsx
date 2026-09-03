/**
 * "Sesiuni" on an Angajați row — the devices one employee is signed in on, and
 * the button that ends them (TODO-56).
 *
 * This exists because a lost phone used to have no honest answer. `/auth/**` is
 * self-scoped, so an admin's only levers were changing the person's role (which
 * revokes sessions as a SIDE EFFECT and also changes what they may do),
 * deleting them, or waiting out the refresh-token lifetime — which is a year.
 *
 * The device label and last-used time are shown rather than offering a blind
 * "revoke everything": someone may hold up to `max-sessions-per-user` devices,
 * and picking the stolen one out of the list is the whole task. No IP is shown
 * because the app has never stored one.
 *
 * Mounted only while open (see CLAUDE.md, local-state rules): the dialog resets
 * by not existing, and the query is `enabled` on the same condition, so a
 * roster of ten people does not fetch ten device lists to render a table.
 */

import { MonitorSmartphone } from 'lucide-react';
import { Badge, Button, EmptyState, Modal, Skeleton, useConfirm, useToast } from '@/components/ui';
import { formatDateTime } from '@/components/domain';
import { serverMessage } from '@/api';
import type { Employee } from '@/types/domain';
import {
  useEmployeeSessions,
  useRevokeAllEmployeeSessions,
  useRevokeEmployeeSession,
} from './queries';

/**
 * The server's own Romanian sentence when it wrote one, this screen's phrasing
 * otherwise — `serverMessage` is the single place that decides which bodies are
 * fit to show (TODO-51). Here it matters for the 404: "Angajatul nu a fost
 * găsit" is the difference between a stale roster and a broken screen.
 */
function reason(error: unknown, fallback: string): string {
  return serverMessage(error) ?? fallback;
}

function SessionsBody({ employee }: { employee: Employee }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: sessions, isLoading, isError, error } = useEmployeeSessions(employee.id, true);
  const revokeOne = useRevokeEmployeeSession();
  const revokeAll = useRevokeAllEmployeeSessions();

  // `current` can only ever be true here when an admin opens their OWN row —
  // it means "the device making this request", not "this employee's newest".
  const revocable = (sessions ?? []).filter((session) => !session.current);

  async function revokeEverything() {
    const ok = await confirm({
      title: 'Revocă toate sesiunile',
      body: `${employee.fullName} va fi deconectat de pe ${
        revocable.length === 1 ? 'dispozitivul listat' : `cele ${revocable.length} dispozitive listate`
      } și va avea nevoie de o cerere de acces nouă.`,
      confirmLabel: 'Revocă tot',
      destructive: true,
    });
    if (!ok) return;
    revokeAll.mutate(employee.id, {
      onSuccess: (revoked) =>
        toast.success(
          revoked === 1 ? 'O sesiune a fost revocată.' : `${revoked} sesiuni au fost revocate.`,
        ),
      onError: (failure) => toast.error(reason(failure, 'Revocarea a eșuat.')),
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return <EmptyState title="Sesiunile nu au putut fi încărcate" body={reason(error, 'Încearcă din nou.')} />;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <EmptyState
        title="Niciun dispozitiv activ"
        body="Nu există nicio sesiune activă pentru acest angajat. Va primi acces din nou după o cerere aprobată."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm text-ink">
                <MonitorSmartphone className="size-4 shrink-0 text-ink-subtle" />
                {session.device}
                {session.current && <Badge tone="info">acest dispozitiv</Badge>}
              </p>
              <p className="text-xs text-ink-subtle">
                Activ ultima dată: {formatDateTime(session.lastUsedAt)} · înrolat:{' '}
                {formatDateTime(session.createdAt)}
              </p>
            </div>
            {!session.current && (
              <Button
                size="sm"
                variant="ghost"
                loading={revokeOne.isPending && revokeOne.variables?.sessionId === session.id}
                onClick={() =>
                  revokeOne.mutate(
                    { employeeId: employee.id, sessionId: session.id },
                    {
                      onSuccess: () => toast.success('Sesiunea a fost revocată.'),
                      onError: (failure) => toast.error(reason(failure, 'Revocarea a eșuat.')),
                    },
                  )
                }
              >
                Revocă
              </Button>
            )}
          </li>
        ))}
      </ul>

      {revocable.length > 0 && (
        <Button
          variant="secondary"
          size="sm"
          loading={revokeAll.isPending}
          onClick={() => void revokeEverything()}
        >
          Revocă toate sesiunile
        </Button>
      )}
    </div>
  );
}

export function EmployeeSessionsModal({
  employee,
  onClose,
}: {
  employee: Employee | null;
  onClose: () => void;
}) {
  if (!employee) return null;
  return (
    <Modal open onClose={onClose} title={`Sesiuni · ${employee.fullName}`} width="sm">
      <SessionsBody employee={employee} />
    </Modal>
  );
}
