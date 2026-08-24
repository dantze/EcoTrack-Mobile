/**
 * Route guards, wired up in src/routes/router.tsx.
 *
 * `RequireAuth` sits above the entire authenticated route tree. While the
 * session is being restored (`status === 'loading'`) it renders a bare
 * spinner instead of the tree — never the login page — so a user who is
 * actually signed in never sees a flash of the login screen on reload. Once
 * settled, it either renders the tree (`Outlet`) or bounces to /login with
 * the attempted location stashed in navigation state, so LoginPage can send
 * the user back where they came from.
 *
 * `RequireRole` sits inside it, per route subtree, and renders the Romanian
 * "acces interzis" page instead of the children when the signed-in user does
 * not hold any of the required roles (e.g. a Sales-only account opening
 * /rute directly).
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@/types/domain';
import { Spinner } from '@/components/ui';
import { ForbiddenPage } from '@/features/auth/ForbiddenPage';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-sunken">
        <Spinner className="size-6 text-brand-600" />
      </div>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { hasRole } = useAuth();
  if (!roles.some((role) => hasRole(role))) return <ForbiddenPage />;
  return <Outlet />;
}
