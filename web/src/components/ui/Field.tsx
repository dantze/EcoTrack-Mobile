/**
 * Field shell — the label / control / hint / error stack every form control
 * shares, so the vertical rhythm of a form is decided in exactly one place.
 *
 * Built on shadcn's `Field` primitives rather than bare elements: `Field`
 * carries the `group/field` hooks the checkbox and input primitives style
 * themselves against, and `FieldError` already renders `role="alert"`, which
 * is what puts a validation message in front of a screen reader.
 *
 * The label is deliberately smaller and quieter than shadcn's default. A form
 * in this app is a dense grid of ten fields inside a drawer, not a marketing
 * sign-up, and a 14px label per row doubles the height of every one of them.
 */

import type { ReactNode } from 'react';
import {
  Field as ShadcnField,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/shadcn/field';
import { cn } from './utils';

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

/** Id of the `<label>` a control can point `aria-labelledby` at. */
export const labelId = (id: string) => `${id}-label`;

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
    <ShadcnField
      data-invalid={error ? true : undefined}
      className={cn('min-w-0 gap-1.5', className)}
    >
      {label && (
        <FieldLabel
          id={labelId(id)}
          htmlFor={id}
          className="w-full text-xs font-medium text-ink-muted"
        >
          <span className="truncate">
            {label}
            {required && (
              <span className="text-destructive" aria-hidden>
                {' *'}
              </span>
            )}
          </span>
        </FieldLabel>
      )}
      {children}
      {error ? (
        <FieldError id={errorId} className="text-xs text-destructive">
          {error}
        </FieldError>
      ) : hint ? (
        <FieldDescription id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </FieldDescription>
      ) : null}
    </ShadcnField>
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
 *
 * Always one column below `sm`. Two 40px inputs side by side inside a 390px
 * drawer leaves ~150px each, which is narrower than the dates and money
 * amounts that go in them — the row has to stack, not shrink.
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
      className={cn(
        'grid grid-cols-1 gap-3',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
