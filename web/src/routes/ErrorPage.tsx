/**
 * Root `errorElement` (React Router 7) — the app's error boundary.
 *
 * Wired onto the root route in router.tsx, this catches anything a route
 * element throws while rendering anywhere below it, so one bad render shows a
 * Romanian message instead of a blank white screen.
 *
 * It renders OUTSIDE the shell (the shell may be the thing that threw), so it
 * fills the viewport rather than a content pane.
 *
 * The technical detail is present but folded away. Whoever hits this needs one
 * sentence and a reload; whoever they then call needs the message verbatim, and
 * "what did it say?" over the phone is a worse channel than a block they can
 * copy. A native `<details>` keeps that true even if the failure was in the
 * component layer itself — no primitive of ours has to survive for it to open.
 */

import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui';
import { StatusScreen } from '@/features/auth/StatusScreen';

/** Everything we can honestly say about the failure, as plain text to copy. */
function describe(error: unknown): string | null {
  if (isRouteErrorResponse(error)) {
    return [`${error.status} ${error.statusText}`, typeof error.data === 'string' ? error.data : null]
      .filter(Boolean)
      .join('\n');
  }
  if (error instanceof Error) return error.stack ?? error.message;
  if (typeof error === 'string') return error;
  return null;
}

export function ErrorPage() {
  const detail = describe(useRouteError());

  return (
    <StatusScreen
      fullScreen
      icon={<TriangleAlert aria-hidden />}
      title="A apărut o eroare neașteptată"
      body="Încearcă să reîncarci pagina. Dacă problema persistă, trimite echipei tehnice detaliile de mai jos."
      actions={
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reîncarcă pagina
        </Button>
      }
      detail={
        detail && (
          <details className="w-full max-w-md text-left">
            <summary className="cursor-pointer rounded-md px-2 py-1 text-xs text-ink-muted transition-colors outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring">
              Detalii tehnice
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-surface-sunken p-3 text-left text-[0.6875rem] leading-relaxed whitespace-pre-wrap text-ink-muted">
              {detail}
            </pre>
          </details>
        )
      }
    />
  );
}
