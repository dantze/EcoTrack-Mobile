/**
 * User menu pinned to the bottom of the sidebar (rendered by AppShell).
 *
 * A trigger button opens a small account modal — fullName, role badges, and
 * "Deconectare" — which can drill into "Sesiuni active", a list of the
 * devices holding a live refresh token for this account (GET /auth/sessions)
 * with per-device revoke. Built from Modal rather than a hand-rolled
 * dropdown: the overlay kit already owns focus trap / ESC / backdrop click,
 * and a sidebar-anchored popover menu is not part of the frozen ui contract.
 */

import { useState } from 'react';
import { useAuth } from '@/auth';
import { Badge, Button, EmptyState, Modal, Skeleton, useToast } from '@/components/ui';
import { ROLE_LABELS } from '@/components/domain';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from './queries';

const dateTimeFormatter = new Intl.DateTimeFormat('ro-RO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatWhen(iso: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? '—' : dateTimeFormatter.format(parsed);
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0]! + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function SessionsPanel() {
  const toast = useToast();
  const { data: sessions, isLoading } = useSessions(true);
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  const others = (sessions ?? []).filter((session) => !session.current);

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : sessions && sessions.length > 0 ? (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm text-ink">
                    {session.device}
                    {session.current && <Badge tone="info">acest dispozitiv</Badge>}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    Activ ultima dată: {formatWhen(session.lastUsedAt)}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={revokeSession.isPending && revokeSession.variables === session.id}
                    onClick={() =>
                      revokeSession.mutate(session.id, {
                        onError: () => toast.error('Nu s-a putut revoca sesiunea.'),
                      })
                    }
                  >
                    Revocă
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {others.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              loading={revokeOthers.isPending}
              onClick={() =>
                revokeOthers.mutate(undefined, {
                  onSuccess: () => toast.success('Celelalte sesiuni au fost deconectate.'),
                  onError: () => toast.error('Nu s-au putut revoca celelalte sesiuni.'),
                })
              }
            >
              Deconectează toate celelalte dispozitive
            </Button>
          )}
        </>
      ) : (
        <EmptyState title="Nicio sesiune activă găsită" />
      )}
    </div>
  );
}

export function AccountMenu() {
  const { user, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAccountOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/10"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
          {initials(user.fullName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{user.fullName}</span>
          <span className="block truncate text-xs text-white/50">{user.username}</span>
        </span>
      </button>

      <Modal open={accountOpen} onClose={() => setAccountOpen(false)} title="Cont" width="sm">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-ink">{user.fullName}</p>
            <p className="text-xs text-ink-subtle">{user.email ?? user.username}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {user.roles.length > 0 ? (
              user.roles.map((role) => (
                <Badge key={role} tone="info">
                  {ROLE_LABELS[role]}
                </Badge>
              ))
            ) : (
              <Badge>Fără rol</Badge>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setAccountOpen(false);
                setSessionsOpen(true);
              }}
            >
              Sesiuni active
            </Button>
            <Button variant="danger" onClick={() => void logout()}>
              Deconectare
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={sessionsOpen} onClose={() => setSessionsOpen(false)} title="Sesiuni active" width="sm">
        <SessionsPanel />
      </Modal>
    </>
  );
}
