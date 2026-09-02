/**
 * The one shape every suggestion in this app takes — the Sales order pre-fill
 * and the dispatch board's stop reordering.
 *
 * Rules it exists to enforce:
 *   - a suggestion is always visibly a suggestion, never a filled-in field;
 *   - it says exactly what it will change *before* it changes anything;
 *   - it explains where it came from, so the operator can judge it;
 *   - accepting is one click, ignoring is one click, and ignoring is free.
 *
 * Nothing here talks to the server or writes state — the parent owns both.
 */

import type { ReactNode } from 'react';
import { Sparkles, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert';
import { ItemActions } from '@/components/shadcn/item';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function SuggestionCard({
  title,
  details,
  basis,
  applyLabel = 'Aplică',
  dismissLabel = 'Ignoră',
  layout = 'inline',
  busy = false,
  onApply,
  onDismiss,
}: {
  title: string;
  /** Bullet list of what applying would set. */
  details?: string[];
  /** Footnote: which records this was derived from. */
  basis?: string;
  applyLabel?: string;
  dismissLabel?: string;
  /**
   * `inline` puts the buttons beside the text (wide forms and drawers);
   * `stacked` drops them onto their own row, for narrow columns like the
   * dispatch board's route panel where side-by-side would squeeze the text
   * into two words per line.
   */
  layout?: 'inline' | 'stacked';
  /** Disables both buttons while the accepted action is in flight. */
  busy?: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const stacked = layout === 'stacked';

  return (
    <Alert className="border-info-200 bg-info-50 text-ink">
      <Sparkles className="text-info-700" />
      <div
        className={cn(
          'col-start-2',
          stacked ? 'flex flex-col gap-2' : 'flex items-start justify-between gap-3',
        )}
      >
        <div className="min-w-0">
          <AlertTitle className="text-info-700">{title}</AlertTitle>
          {details && details.length > 0 && (
            <AlertDescription className="mt-1.5 text-xs text-ink-muted">
              <ul className="flex flex-col gap-0.5">
                {details.map((detail) => (
                  <li key={detail}>· {detail}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
          {basis && <p className="mt-1.5 text-xs text-ink-subtle italic">{basis}</p>}
        </div>
        <ItemActions className={cn('gap-1.5', stacked ? 'justify-end' : 'shrink-0')}>
          <Button size="sm" variant="secondary" disabled={busy} onClick={onDismiss}>
            {dismissLabel}
          </Button>
          <Button size="sm" variant="primary" loading={busy} onClick={onApply}>
            {applyLabel}
          </Button>
        </ItemActions>
      </div>
    </Alert>
  );
}

/**
 * Non-blocking warning strip — an anomaly the operator should look at but is
 * always allowed to save. Deliberately not a field error: it must not turn a
 * legitimate large order into something you have to fight the form to enter.
 */
export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <Alert
      role="status"
      className="mt-1.5 border-warning-200 bg-warning-50 text-xs text-warning-700"
    >
      <TriangleAlert className="text-warning-600" />
      <AlertTitle className="font-normal text-warning-700">{children}</AlertTitle>
    </Alert>
  );
}
