/** Multi-line text, for notes and addresses. */

import { Textarea } from '@/components/shadcn/textarea';
import { describedBy, FieldShell } from './Field';
import { cn, useFieldIds } from './utils';
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
      <Textarea
        {...rest}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
        // `field-sizing-content` comes from the primitive and grows the box as
        // the operator types, with `rows` acting as the floor; `resize-y`
        // leaves the manual handle for a long address.
        className={cn(
          'min-h-0 resize-y bg-surface text-sm leading-relaxed text-ink placeholder:text-ink-subtle',
          className,
        )}
      />
    </FieldShell>
  );
}
