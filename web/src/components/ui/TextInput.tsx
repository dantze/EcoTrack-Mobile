/**
 * Single-line text input.
 *
 * Plain, it is a shadcn `Input` inside the kit's `FieldShell`. Given a leading
 * icon or a trailing adornment it becomes a shadcn `InputGroup` instead —
 * which is not the same thing as absolutely positioning an icon over an input:
 * the group owns the border and the focus ring, so the whole control lights up
 * as one, and the addon reserves real width rather than sitting on top of the
 * text the operator is typing.
 */

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/shadcn/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/shadcn/input-group';
import { describedBy, FieldShell } from './Field';
import { CONTROL_HEIGHT, cn, useFieldIds } from './utils';
import type { TextInputProps } from './types';

export interface TextInputExtraProps {
  /** Icon or short label rendered inside the control, on the left. */
  leading?: ReactNode;
  /** Icon, unit, or button rendered inside the control, on the right. */
  trailing?: ReactNode;
  inputSize?: 'sm' | 'md';
  /** Class for the outer field stack (the control itself uses `className`). */
  fieldClassName?: string;
  /**
   * Adds a clear button once the field has text — the search affordance most
   * of the list screens want. Fires `onClear`, then focuses the input again so
   * the operator can retype without reaching for the mouse.
   */
  clearable?: boolean;
  onClear?: () => void;
  /** Accessible name for that button. */
  clearLabel?: string;
}

/** Same silhouette as `CONTROL_HEIGHT`, applied to the group's border box. */
const GROUP_HEIGHT: Record<'sm' | 'md', string> = {
  sm: 'h-9 sm:h-7',
  md: 'h-10 sm:h-8',
};

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
  clearable = false,
  onClear,
  clearLabel = 'Golește câmpul',
  id: explicitId,
  ...rest
}: TextInputProps & TextInputExtraProps) {
  const { id, hintId, errorId } = useFieldIds(explicitId);

  const showClear = clearable && Boolean(onClear) && String(rest.value ?? '').length > 0;
  const grouped = Boolean(leading) || Boolean(trailing) || showClear;

  const shared = {
    ...rest,
    id,
    required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy(hintId, errorId, hint, error),
  } as const;

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
      {grouped ? (
        <InputGroup
          className={cn(
            GROUP_HEIGHT[inputSize],
            'bg-surface',
            error && 'border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:ring-destructive/25',
          )}
        >
          {leading && (
            <InputGroupAddon className="text-ink-subtle">{leading}</InputGroupAddon>
          )}
          <InputGroupInput {...shared} className={cn('text-sm text-ink', className)} />
          {(trailing || showClear) && (
            <InputGroupAddon align="inline-end" className="text-ink-subtle">
              {showClear && (
                <InputGroupButton
                  size="icon-xs"
                  aria-label={clearLabel}
                  onClick={() => onClear?.()}
                >
                  <X />
                </InputGroupButton>
              )}
              {trailing}
            </InputGroupAddon>
          )}
        </InputGroup>
      ) : (
        <Input
          {...shared}
          className={cn(
            CONTROL_HEIGHT[inputSize],
            'bg-surface text-sm text-ink placeholder:text-ink-subtle',
            className,
          )}
        />
      )}
    </FieldShell>
  );
}
