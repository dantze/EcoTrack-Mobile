/**
 * Date field — Mantine's `DateInput`, on our chrome.
 *
 * The native `<input type="date">` this replaces was cheap but wrong for the
 * job: its calendar is OS chrome that ignores our type scale and our theme,
 * its segment order follows the browser's locale rather than the app's, and
 * there is no way to put "azi / mâine" presets inside it. Mantine gives a
 * typeable field AND a themed calendar, and — the part that decided it —
 * speaks `YYYY-MM-DD` strings natively, so the kit's value contract survives
 * untouched. No `Date` object ever enters or leaves this component.
 *
 * Romanian input is the default: the field displays and accepts `DD.MM.YYYY`
 * (what an operator types), and `dateParser` also accepts `/` and `-`
 * separators plus a bare ISO string pasted from elsewhere.
 */

import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/ro';
import { DateInput as MantineDateInput } from '@mantine/dates';
import { CalendarDays } from 'lucide-react';
import { describedBy, FieldShell } from './Field';
import { cn, useFieldIds } from './utils';
import type { DateInputProps } from './types';

// dayjs parses loosely without this — "13.01.2026" and "01.13.2026" would both
// come back as a date, and one of them is not the one that was typed.
dayjs.extend(customParseFormat);
dayjs.locale('ro');

const TYPED_FORMATS = ['DD.MM.YYYY', 'D.M.YYYY', 'DD/MM/YYYY', 'D/M/YYYY', 'YYYY-MM-DD'];

/** What the operator typed → the ISO string the app stores, or null. */
function parseTyped(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  for (const format of TYPED_FORMATS) {
    const parsed = dayjs(trimmed, format, true);
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD');
  }
  return null;
}

export interface DateInputExtraProps {
  /** Explicit control id, so a caller can label or focus this field itself. */
  id?: string;
  size?: 'sm' | 'md';
  className?: string;
  /** Quick-set row under the field, e.g. `[{ label: 'Azi', value: today }]`. */
  presets?: { label: string; value: string }[];
  placeholder?: string;
  clearable?: boolean;
}

export function DateInput({
  id: explicitId,
  label,
  error,
  hint,
  required,
  value,
  onChange,
  min,
  max,
  disabled,
  size = 'md',
  className,
  presets,
  placeholder = 'zz.ll.aaaa',
  clearable = false,
}: DateInputProps & DateInputExtraProps) {
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
      <MantineDateInput
        id={id}
        value={value ?? null}
        onChange={(next) => onChange(next ?? null)}
        minDate={min || undefined}
        maxDate={max || undefined}
        disabled={disabled}
        placeholder={placeholder}
        valueFormat="DD.MM.YYYY"
        dateParser={parseTyped}
        clearable={clearable}
        firstDayOfWeek={1}
        weekendDays={[0, 6]}
        // NOT `withinPortal` — the calendar must render inside the DOM subtree
        // it belongs to, and this is a correctness fix rather than a styling
        // preference.
        //
        // Every drawer and dialog in the kit is a Radix `Dialog`/`Sheet` in
        // modal mode, and Radix enforces that by putting `pointer-events: none`
        // on <body> while one is open — only its own subtree stays clickable. A
        // portalled dropdown is mounted on <body>, OUTSIDE that subtree, so it
        // inherited `pointer-events: none`: the calendar rendered, the day cells
        // could not be clicked, the click fell through to the backdrop and
        // dismissed the popover, and the field stayed empty. That made every
        // date in a drawer unsettable — an order could not be saved at all —
        // while a typed date still worked, which is why it read as a mystery.
        //
        // Rendering in place costs the portal's escape from `overflow` clipping;
        // Mantine flips the dropdown above the field when there is no room
        // below, which is what the drawer's scroll container needs anyway.
        popoverProps={{ withinPortal: false, shadow: 'md', position: 'bottom-start' }}
        rightSection={<CalendarDays aria-hidden className="size-3.5 text-ink-subtle" />}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId, hint, error)}
        // Mantine's own sizing is one notch taller than a shadcn control; the
        // Styles API is how the two end up the same height in the same row.
        classNames={{
          input: cn(
            'tabular rounded-lg border-input bg-surface text-sm text-ink placeholder:text-ink-subtle',
            'focus:border-ring focus:ring-3 focus:ring-ring/50',
            'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-subtle',
            size === 'sm' ? 'h-9 sm:h-7' : 'h-10 sm:h-8',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/25',
            className,
          ),
          section: 'text-ink-subtle',
          calendarHeaderControl: 'text-ink hover:bg-surface-hover',
          calendarHeaderLevel: 'text-ink font-semibold',
          weekday: 'text-ink-subtle text-xs',
          day: cn(
            'text-ink rounded-md hover:bg-surface-hover',
            'data-[selected]:bg-primary data-[selected]:text-primary-foreground',
            'data-[today]:font-semibold data-[today]:text-primary',
            'data-[outside]:text-ink-subtle data-[weekend]:text-ink',
          ),
        }}
      />

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.value)}
              aria-pressed={value === preset.value}
              className={cn(
                'rounded px-1.5 py-0.5 text-xs transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                value === preset.value
                  ? 'bg-surface-active font-medium text-primary'
                  : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
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
