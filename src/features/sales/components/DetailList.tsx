/**
 * Read-only key/value display used inside the detail drawers.
 */

import type { ReactNode } from 'react';

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border py-3 first:pt-0 last:border-b-0">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {title}
      </h3>
      <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5">{children}</dl>
    </section>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm break-words text-ink">{children ?? '—'}</dd>
    </>
  );
}

/** Renders `—` for empty strings and nullish values. */
export function Value({ children }: { children: string | number | null | undefined }) {
  if (children === null || children === undefined || children === '') return <>—</>;
  return <>{children}</>;
}
