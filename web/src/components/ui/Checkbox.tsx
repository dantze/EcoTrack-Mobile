/**
 * Checkbox — shadcn's Radix checkbox, wired to the kit's `checked/onChange`
 * contract and given the kit's density.
 *
 * Two things are done here rather than left to the primitive:
 *
 * 1. **The checked fill.** The installed `radix-ui` build reports its state as
 *    `data-state="checked" | "indeterminate" | "unchecked"`, while the shadcn
 *    file was generated against a newer build that emits `data-checked`. Its
 *    fill classes therefore never fire, so the state classes below are the
 *    ones actually painting the box. Drop them and a ticked checkbox looks
 *    exactly like an empty one.
 * 2. **The indeterminate glyph.** The primitive's indicator only ever draws a
 *    tick, and its children are fixed, so the dash for a partial selection is
 *    drawn over the box and the tick is hidden underneath it.
 *
 * The label is a sibling `<label htmlFor>`, never a wrapper: a `<label>` around
 * a `<button role="checkbox">` forwards its own click to that button, so a
 * click landing on the box itself toggles twice and nets out to nothing.
 */

import { useId } from 'react';
import { Checkbox as ShadcnCheckbox } from '@/components/shadcn/checkbox';
import { Label } from '@/components/shadcn/label';
import { cn } from './utils';
import type { CheckboxProps } from './types';

export interface CheckboxExtraProps {
  /** For the table's select-all cell, where the label is visually redundant. */
  ariaLabel?: string;
  className?: string;
  /** Explicit id, so a caller can point its own label at this box. */
  id?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
  disabled,
  ariaLabel,
  className,
  id: explicitId,
}: CheckboxProps & CheckboxExtraProps) {
  const auto = useId();
  const id = explicitId ?? auto;
  const isIndeterminate = Boolean(indeterminate) && !checked;

  return (
    <span
      className={cn(
        'group/checkbox inline-flex items-center gap-2 text-sm select-none',
        // A finger needs more than 16px. The primitive's `after:` pseudo
        // already widens the hit area; this gives the row the height to match
        // on a phone without loosening the desktop table's 30px rows.
        'min-h-9 sm:min-h-0',
        disabled && 'opacity-55',
        className,
      )}
    >
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <ShadcnCheckbox
          id={id}
          checked={isIndeterminate ? 'indeterminate' : checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onCheckedChange={(next) => onChange(next === true)}
          className={cn(
            'border-input bg-surface',
            'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
            'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
            'not-disabled:hover:border-border-strong',
            isIndeterminate && '[&_[data-slot=checkbox-indicator]]:opacity-0',
          )}
        />
        {isIndeterminate && (
          <span
            aria-hidden
            className="pointer-events-none absolute h-0.5 w-2 rounded-full bg-primary-foreground"
          />
        )}
      </span>
      {label && (
        <Label
          htmlFor={id}
          className={cn(
            'min-w-0 text-sm font-normal text-ink',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          {label}
        </Label>
      )}
    </span>
  );
}
