/**
 * Catch-all route (src/routes/router.tsx). Anything that doesn't match a
 * known page lands here instead of the router silently rendering nothing.
 */

import { FileQuestion } from 'lucide-react';
import { StatusScreen } from './StatusScreen';

export function NotFoundPage() {
  return (
    <StatusScreen
      icon={<FileQuestion aria-hidden />}
      title="Pagina nu a fost găsită"
      body="Adresa cerută nu există în aplicație. Poate a fost redenumită sau linkul este incomplet."
    />
  );
}
