/**
 * ISO date field. Stays on the native date control — it gives us the OS
 * calendar, keyboard entry, and locale-correct segment order for free, which a
 * hand-built picker would only approximate. We restyle its chrome to match the
 * other controls and keep the value strictly "YYYY-MM-DD".
 */

import { describedBy, FieldShell } from './Field';
import { controlClass, cx, useFieldIds } from './utils';
import type { DateInputProps } from './types';

export interface DateInputExtraProps {
  size?: 'sm' | 'md';
  className?: string;
  /** Quick-set row under the field, e.g. `[{ label: 'Azi', value: today }]`. */
  presets?: { label: string; value: string }[];
}

export function DateInput({
  label,
  error,
  hint,
  required,
  value,
  onChange,
  size = 'md',
  className,
  presets,
  ...rest
}: DateInputProps & DateInputExtraProps) {
  const { id, hintId, errorId } = useFieldIds();

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
      <input
        {...rest}
        id={id}
        type="date"
        value={value ?? ''}
        required={required}
        onChange={(event) => onChange(event.target.value || null)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
        className={controlClass(
          Boolean(error),
          size,
          cx(
            'tabular [&::-webkit-calendar-picker-indicator]:cursor-pointer',
            '[&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-90',
            className,
          ),
        )}
      />
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.value)}
              className={cx(
                'rounded px-1.5 py-0.5 text-xs transition-colors',
                value === preset.value
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </FieldShell>
  );
}
