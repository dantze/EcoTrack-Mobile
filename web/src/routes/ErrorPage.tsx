/**
 * Root `errorElement` (React Router 7) — the app's error boundary.
 *
 * Wired onto the root route in router.tsx, this catches anything a route
 * element throws while rendering anywhere below it, so one bad render shows a
 * Romanian message instead of a blank white screen.
 */

import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui';

export function ErrorPage() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null;

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-surface-sunken px-6 text-center">
      <p className="text-sm font-semibold text-ink">A apărut o eroare neașteptată</p>
      <p className="max-w-sm text-sm text-ink-muted">
        Încearcă să reîncarci pagina. Dacă problema persistă, contactează echipa tehnică.
      </p>
      {detail && <p className="max-w-md truncate text-xs text-ink-subtle">{detail}</p>}
      <Button variant="primary" onClick={() => window.location.reload()}>
        Reîncarcă pagina
      </Button>
    </div>
  );
}
