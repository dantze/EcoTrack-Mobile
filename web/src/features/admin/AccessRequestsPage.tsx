/**
 * Cereri de acces — the admin's approval queue.
 *
 * This screen is the entire access-control system: nobody gets into EcoTrack
 * except through a row here. Two things on it carry real weight:
 *
 *   - The SIX-DIGIT CODE is shown to the requester on their own screen too.
 *     Approving without checking it matches what the person reads out is what
 *     lets an attacker be approved in someone else's name, so the UI leads
 *     with it rather than burying it.
 *   - The ROLE is chosen at approval time and is what the person gets. There
 *     is no separate "set role later" step.
 *
 * Requests expire on their own (ten minutes), so the list polls and shows a
 * live countdown — a stale queue here is actively misleading.
 */

import { useState } from 'react';
import type { AccessRequest } from '@/api/contract';
import { CommandBar, Workbench, WorkbenchBody } from '@/components/layout';
import { Badge, Button, EmptyState, Select, Spinner, useToast } from '@/components/ui';
import { ROLE_LABELS } from '@/components/domain';
import type { Role } from '@/types/domain';
import { useAccessRequests, useApproveRequest, useRejectRequest } from './queries';

/**
 * Roles an admin may grant, driver first because it is the common case.
 * Mirrors the backend's assignable set exactly — approving anything outside it
 * is rejected server-side.
 */
const ASSIGNABLE: Role[] = ['DRIVER', 'SALES', 'TECH', 'ADMIN'];

function remaining(expiresAt: string): string | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function RequestCard({ request }: { request: AccessRequest }) {
  const [role, setRole] = useState<Role>('DRIVER');
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const toast = useToast();
  const busy = approve.isPending || reject.isPending;
  const countdown = remaining(request.expiresAt);
  const decided = request.status !== 'PENDING';

  return (
    <li className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium text-ink">{request.fullName}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {request.deviceLabel ?? 'Dispozitiv necunoscut'}
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-3xl tracking-[0.2em] text-ink">
            {request.verificationCode}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {decided ? 'Aprobat — se așteaptă dispozitivul' : `Expiră în ${countdown ?? '0:00'}`}
          </p>
        </div>
      </div>

      {decided ? (
        <div className="mt-4">
          <Badge tone="info">
            {request.assignedRoleName ? ROLE_LABELS[request.assignedRoleName] : 'Aprobat'}
          </Badge>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <Select
            label="Rol"
            value={role}
            onChange={(next) => setRole(next as Role)}
            options={ASSIGNABLE.map((option) => ({ value: option, label: ROLE_LABELS[option] }))}
            className="w-44"
          />

          <Button
            disabled={busy}
            onClick={() =>
              approve.mutate(
                { id: request.id, role },
                {
                  onSuccess: () =>
                    toast.success(`${request.fullName} a primit rolul ${ROLE_LABELS[role]}.`),
                  onError: () => toast.error('Aprobarea a eșuat.'),
                },
              )
            }
          >
            Aprobă
          </Button>

          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              reject.mutate(request.id, {
                onSuccess: () => toast.success('Cererea a fost respinsă.'),
                onError: () => toast.error('Respingerea a eșuat.'),
              })
            }
          >
            Respinge
          </Button>
        </div>
      )}
    </li>
  );
}

export function AccessRequestsPage() {
  const { data, isLoading } = useAccessRequests();
  const requests = data ?? [];

  return (
    <Workbench>
      <CommandBar
        title="Cereri de acces"
        subtitle={
          isLoading
            ? 'Se încarcă…'
            : `${requests.length} în așteptare · verifică codul cu persoana care cere accesul, apoi alege-i rolul`
        }
      />

      <WorkbenchBody>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            title="Nicio cerere în așteptare"
            body="Cererile apar aici imediat ce cineva deschide aplicația și cere acces."
          />
        ) : (
          <ul className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </ul>
        )}
      </WorkbenchBody>
    </Workbench>
  );
}
