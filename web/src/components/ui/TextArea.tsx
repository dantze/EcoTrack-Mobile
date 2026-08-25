/** Multi-line text, for notes and addresses. */

import { describedBy, FieldShell } from './Field';
import { CONTROL_BASE, CONTROL_ERROR, CONTROL_IDLE, cx, useFieldIds } from './utils';
import type { TextAreaProps } from './types';

export function TextArea({
  label,
  error,
  hint,
  required,
  className,
  rows = 3,
  id: explicitId,
  ...rest
}: TextAreaProps) {
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
    >
      <textarea
        {...rest}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
        className={cx(
          CONTROL_BASE,
          'resize-y px-2.5 py-1.5 leading-relaxed',
          error ? CONTROL_ERROR : CONTROL_IDLE,
          className,
        )}
      />
    </FieldShell>
  );
}
