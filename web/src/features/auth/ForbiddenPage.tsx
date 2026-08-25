/**
 * Rendered by `RequireRole` (src/auth/RequireAuth.tsx) when a signed-in user's
 * roles do not cover the route they landed on — e.g. a Sales-only account
 * opening /rute directly. Distinct from NotFoundPage: the route exists, the
 * account just cannot see it.
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';

export function ForbiddenPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-sm font-semibold text-ink">Acces interzis</p>
      <p className="max-w-sm text-sm text-ink-muted">
        Contul tău nu are rolul necesar pentru această secțiune. Dacă ai nevoie de acces,
        contactează un administrator.
      </p>
      <Link to="/">
        <Button variant="secondary">Înapoi la pagina principală</Button>
      </Link>
    </div>
  );
}
