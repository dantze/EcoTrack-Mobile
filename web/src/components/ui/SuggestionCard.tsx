/**
 * The one shape every suggestion in this app takes — Sales pre-fills, dispatch
 * groupings, route reordering.
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
  children,
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
  children?: ReactNode;
}) {
  const stacked = layout === 'stacked';
  return (
    <div className="rounded-md border border-brand-200 bg-brand-50/60 px-3 py-2.5">
      <div className={stacked ? 'flex flex-col gap-2' : 'flex items-start justify-between gap-3'}>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
            <SparkIcon />
            {title}
          </p>
          {details && details.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {details.map((detail) => (
                <li key={detail} className="text-xs text-ink-muted">
                  · {detail}
                </li>
              ))}
            </ul>
          )}
          {children}
          {basis && <p className="mt-1.5 text-xs text-ink-subtle italic">{basis}</p>}
        </div>
        <div className={stacked ? 'flex justify-end gap-1.5' : 'flex shrink-0 gap-1.5'}>
          <Button size="sm" variant="secondary" disabled={busy} onClick={onDismiss}>
            {dismissLabel}
          </Button>
          <Button size="sm" variant="primary" loading={busy} onClick={onApply}>
            {applyLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Non-decorative-looking but decorative: the card's text carries the meaning. */
function SparkIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="size-3.5 shrink-0"
      fill="currentColor"
    >
      <path d="M8 1.5 9.3 5.4 13.2 6.7 9.3 8 8 11.9 6.7 8 2.8 6.7 6.7 5.4zM12.5 10.2l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" />
    </svg>
  );
}

/**
 * Non-blocking warning strip — an anomaly the operator should look at but is
 * always allowed to save. Deliberately not a field error: it must not turn a
 * legitimate large order into something you have to fight the form to enter.
 */
export function WarningNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="mt-1.5 flex items-start gap-1.5 rounded border border-warning-200 bg-warning-50 px-2 py-1.5 text-xs text-warning-700"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="mt-px size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2.8 14.2 13H1.8z" />
        <path d="M8 6.6v2.8M8 11.4h.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
