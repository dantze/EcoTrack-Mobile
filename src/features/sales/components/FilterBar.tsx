/**
 * The strip between the page header and the table: search, filters, a reset.
 * Shared by all four Sales screens so the filtering affordances line up.
 */

import type { ReactNode } from 'react';
import { Button } from '@/components/ui';

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border bg-white px-5 py-2.5">
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  width = 'w-72',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  width?: string;
}) {
  return (
    <div className={`relative ${width}`}>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-md border border-border bg-white pr-2.5 pl-7 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-ink-subtle"
      >
        ⌕
      </span>
    </div>
  );
}

/** Small labelled slot so filter controls align on one baseline. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="m-5 flex items-center justify-between gap-4 rounded-md border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm text-red-800">{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Reîncearcă
        </Button>
      )}
    </div>
  );
}
