/**
 * Checkbox — a real `<input type="checkbox">` kept visually hidden behind a
 * drawn box, so it keeps native keyboard, form, and a11y semantics while
 * matching the kit's 14px density and brand fill.
 */

import { useEffect, useRef } from 'react';
import { CheckIcon } from './icons';
import { cx } from './utils';
import type { CheckboxProps } from './types';

export interface CheckboxExtraProps {
  /** For the table's select-all cell, where the label is visually redundant. */
  ariaLabel?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
  disabled,
  ariaLabel,
  className,
}: CheckboxProps & CheckboxExtraProps) {
  const ref = useRef<HTMLInputElement>(null);
  const isIndeterminate = Boolean(indeterminate) && !checked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  return (
    <label
      className={cx(
        'group inline-flex items-center gap-2 text-sm select-none',
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative flex size-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 size-full cursor-[inherit] appearance-none rounded-[0.25rem] border border-border-strong bg-white transition-colors checked:border-brand-700 checked:bg-brand-700 indeterminate:border-brand-700 indeterminate:bg-brand-700 hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:bg-surface-sunken"
        />
        {isIndeterminate ? (
          <span className="pointer-events-none relative h-0.5 w-2 rounded-full bg-white" />
        ) : (
          <CheckIcon
            className={cx(
              'pointer-events-none relative size-3 text-white transition-opacity',
              checked ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}
      </span>
      {label && <span className="min-w-0 text-ink">{label}</span>}
    </label>
  );
}
