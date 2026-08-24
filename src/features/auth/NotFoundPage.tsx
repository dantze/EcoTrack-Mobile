/**
 * Catch-all route (src/routes/router.tsx). Anything that doesn't match a
 * known page lands here instead of the router silently rendering nothing.
 */

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-sm font-semibold text-ink">Pagina nu a fost găsită</p>
      <p className="max-w-sm text-sm text-ink-muted">Adresa cerută nu există în aplicație.</p>
      <Link to="/">
        <Button variant="secondary">Înapoi la pagina principală</Button>
      </Link>
    </div>
  );
}
