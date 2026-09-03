/**
 * The account menu.
 *
 * The avatar in the top-right of the global bar, exactly where a desktop mail
 * client puts it. It opens a dropdown — identity, role badges, "Sesiuni
 * active" and "Deconectare" — rather than the modal it used to open: a modal
 * for a two-item menu is a full stop in the middle of a glance.
 *
 * "Sesiuni active" is still a Modal, and should be: it lists the devices
 * holding a live refresh token for this account (GET /auth/sessions) with a
 * per-device revoke, which is a task, not a glance.
 */

import { useState } from 'react';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/shadcn/avatar';
import { useAuth } from '@/auth';
import { Badge, Button, EmptyState, Modal, Skeleton, useToast } from '@/components/ui';
import { formatDateTime, ROLE_LABELS } from '@/components/domain';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from './queries';


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
                    Activ ultima dată: {formatDateTime(session.lastUsedAt)}
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
  const [sessionsOpen, setSessionsOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Cont: ${user.fullName}`}
            className="ml-1 flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            {/* The account button Outlook parks in the top-right corner. The
                fallback is the only layer that ever renders today — there is no
                avatar image in the system — but going through the primitive is
                what makes adding one later a one-line change. */}
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="bg-sidebar-accent text-[0.6875rem] font-semibold text-sidebar-foreground">
                {initials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 text-left lg:block">
              <span className="block max-w-36 truncate text-xs font-medium text-sidebar-foreground">
                {user.fullName}
              </span>
              <span className="block max-w-36 truncate text-[0.6875rem] text-sidebar-foreground/60">
                {user.roles.length > 0 ? ROLE_LABELS[user.roles[0]!] : 'Fără rol'}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-ink">{user.fullName}</span>
            <span className="truncate text-xs font-normal text-ink-subtle">
              {user.email ?? user.username}
            </span>
          </DropdownMenuLabel>

          <div className="flex flex-wrap gap-1 px-2 pb-2">
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

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => setSessionsOpen(true)}>
              <MonitorSmartphone />
              Sesiuni active
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                void logout();
              }}
            >
              <LogOut />
              Deconectare
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal
        open={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        title="Sesiuni active"
        width="sm"
      >
        <SessionsPanel />
      </Modal>
    </>
  );
}
