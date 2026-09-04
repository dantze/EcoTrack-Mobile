/**
 * Segmented controls — one choice from a few, and its multi-select sibling.
 *
 * Built on shadcn's `ToggleGroup`. Before this existed the pattern was written
 * three times: `OrderFormDrawer` and `ClientFormDrawer` each hand-rolled a
 * `<div className="inline-flex rounded-md border">` of `<button>`s, and
 * `MapPage` reached past the kit into `@/components/shadcn/toggle-group`
 * directly. The hand-rolled pair looked right and behaved worse — no roving
 * focus, no arrow keys, and nothing telling a screen reader that the buttons
 * are one group with one selected value.
 *
 * WHY `SegmentedControl` IS NOT JUST ToggleGroup WITH type="single":
 * Radix's single-select toggle group is DESELECTABLE — clicking the active
 * item fires `onValueChange('')`. That is right for a formatting toolbar (bold
 * on, bold off) and wrong for a choice that must always have an answer: the
 * order type cannot be "none". So an empty value is swallowed here rather than
 * at each of the three call sites, where it would eventually be forgotten and
 * leave a form in a state its own validator does not model.
 */

import { ButtonGroup as ShadcnButtonGroup } from '@/components/shadcn/button-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group';
import type { ButtonGroupProps, MultiToggleProps, SegmentedControlProps } from './types';
import { cn } from './utils';

/**
 * Buttons that read as one control — the map's zoom cluster, and anywhere else
 * a row or column of icon buttons should share a border rather than float
 * separately. Re-exported through the kit so feature screens do not have to
 * reach into `@/components/shadcn` for it.
 */
export function ButtonGroup({ orientation = 'horizontal', className, children }: ButtonGroupProps) {
  return (
    <ShadcnButtonGroup orientation={orientation} className={className}>
      {children}
    </ShadcnButtonGroup>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size={size === 'sm' ? 'sm' : 'default'}
      value={value}
      // The deselect guard. Radix hands us '' when the active item is clicked
      // again; a segmented control has no empty state, so that is a no-op.
      onValueChange={(next: string) => {
        if (next) onChange(next as T);
      }}
      aria-label={ariaLabel}
      className={cn('max-w-full flex-wrap', className)}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * The multi-select form: independent on/off switches that read as one control.
 * Empty is a legitimate answer here — no layers is a valid map — so there is no
 * guard, which is the whole difference from `SegmentedControl`.
 */
export function MultiToggle<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: MultiToggleProps<T>) {
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      size={size === 'sm' ? 'sm' : 'default'}
      value={value}
      onValueChange={(next: string[]) => onChange(next as T[])}
      aria-label={ariaLabel}
      className={cn('max-w-full flex-wrap', className)}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
