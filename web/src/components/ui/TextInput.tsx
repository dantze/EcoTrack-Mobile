/**
 * Single-line text input, with optional leading/trailing adornments (used by
 * SearchInput and by money fields that need a "RON" suffix).
 */

import type { ReactNode } from 'react';
import { describedBy, FieldShell } from './Field';
import { controlClass, cx, useFieldIds } from './utils';
import type { TextInputProps } from './types';

export interface TextInputExtraProps {
  /** Icon or short label rendered inside the control, on the left. */
  leading?: ReactNode;
  /** Icon, unit, or button rendered inside the control, on the right. */
  trailing?: ReactNode;
  inputSize?: 'sm' | 'md';
  /** Class for the outer field stack (the control itself uses `className`). */
  fieldClassName?: string;
}

export function TextInput({
  label,
  error,
  hint,
  required,
  className,
  leading,
  trailing,
  inputSize = 'md',
  fieldClassName,
  id: explicitId,
  ...rest
}: TextInputProps & TextInputExtraProps) {
  const { id, hintId, errorId } = useFieldIds(explicitId);

  return (
    <FieldShell
      id={id}
      hintId={hintId}
      errorId={errorId}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={fieldClassName}
    >
      <div className="relative flex items-center">
        {leading && (
          <span className="pointer-events-none absolute left-2.5 flex items-center text-ink-subtle [&>svg]:size-4">
            {leading}
          </span>
        )}
        <input
          {...rest}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errorId, hint, error)}
          className={controlClass(
            Boolean(error),
            inputSize,
            cx(Boolean(leading) && 'pl-8', Boolean(trailing) && 'pr-8', className),
          )}
        />
        {trailing && (
          <span className="absolute right-2.5 flex items-center text-ink-subtle [&>svg]:size-4">
            {trailing}
          </span>
        )}
      </div>
    </FieldShell>
  );
}
