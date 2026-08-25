/**
 * Field shell — the label / control / hint / error stack every form control
 * shares, so the vertical rhythm of a form is decided in exactly one place.
 */

import type { ReactNode } from 'react';
import { AlertIcon } from './icons';
import { cx } from './utils';

export interface FieldShellProps {
  id: string;
  hintId: string;
  errorId: string;
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FieldShell({
  id,
  hintId,
  errorId,
  label,
  error,
  hint,
  required,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-ink-muted">
          {label}
          {required && (
            <span className="text-danger-600" aria-hidden>
              {' *'}
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span id={errorId} role="alert" className="flex items-start gap-1 text-xs text-danger-600">
          <AlertIcon className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </span>
      ) : hint ? (
        <span id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** `aria-describedby` value for a control with a hint and/or an error. */
export function describedBy(
  hintId: string,
  errorId: string,
  hint?: string,
  error?: string,
): string | undefined {
  if (error) return errorId;
  if (hint) return hintId;
  return undefined;
}

/**
 * Horizontal group of fields on one row of a form. Feature screens use this
 * instead of hand-rolling a grid per modal.
 */
export function FieldRow({
  children,
  columns = 2,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'grid gap-3',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
