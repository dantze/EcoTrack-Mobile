/**
 * The one dead-end screen, used by all three of them.
 *
 * Acces interzis, Pagina nu a fost găsită and the router's error boundary are
 * the same event from the user's side — a screen they cannot have — so they get
 * the same shape: an icon, one Romanian headline, one sentence of explanation,
 * and a way out that actually leads somewhere. Three near-identical files drifted
 * apart once already; this is what keeps them one design.
 *
 * The way out is role-derived rather than hardcoded to "/": a TECH account sent
 * to the Vânzări home would bounce straight back into ForbiddenPage, which is
 * the loop these screens exist to break.
 */

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState } from '@/components/ui';
import { useAuth } from '@/auth';

/**
 * Where "înapoi" goes for this account. Mirrors `HomeRedirect` in
 * routes/router.tsx — same order, same reasoning — because a link that lands on
 * a route the user's roles do not cover is not a way out.
 */
export function useHomePath(): string {
  const { hasRole, status } = useAuth();
  if (status !== 'authenticated') return '/login';
  if (hasRole('SALES')) return '/comenzi';
  if (hasRole('TECH')) return '/rute';
  if (hasRole('ADMIN')) return '/cereri';
  return '/';
}

export interface StatusScreenProps {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  /** Replaces the default "back home" button when a screen needs its own row. */
  actions?: ReactNode;
  /** Support-only detail, rendered collapsed under the actions. */
  detail?: ReactNode;
  /** Fills the viewport rather than the content pane — for the error boundary,
   *  which renders outside the shell and has no pane to fill. */
  fullScreen?: boolean;
}

export function StatusScreen({
  icon,
  title,
  body,
  actions,
  detail,
  fullScreen = false,
}: StatusScreenProps) {
  const home = useHomePath();
  const navigate = useNavigate();

  return (
    <div
      className={
        fullScreen
          ? 'flex min-h-screen items-center justify-center bg-background px-4 py-12'
          : 'flex h-full min-h-0 items-center justify-center px-4 py-12'
      }
    >
      <div className="w-full max-w-md">
        <EmptyState
          icon={icon}
          title={title}
          body={body}
          action={
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {actions ?? (
                  <Button variant="secondary" onClick={() => navigate(home)}>
                    Înapoi în aplicație
                  </Button>
                )}
              </div>
              {detail}
            </div>
          }
        />
      </div>
    </div>
  );
}
