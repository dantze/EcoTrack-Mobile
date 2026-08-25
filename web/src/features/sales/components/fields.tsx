/**
 * Form building blocks shared by the order and client drawers.
 *
 * Layout is desktop-first: a 12-column grid so a whole order fits in one
 * scannable form instead of the mobile app's four-screen wizard.
 */

import type { ReactNode } from 'react';
import { Select, TextInput, type SelectOption } from '@/components/ui';
import { parseCoordinates } from '@/types/domain';
import type { LocationValue } from '../orderModel';
import { PHONE_CODES } from '../validation';

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border py-4 first:pt-0 last:border-b-0">
      <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** 12-column grid; children pick their span with `<Col span={4}>`. */
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-12 gap-x-3 gap-y-3">{children}</div>;
}

const SPANS: Record<number, string> = {
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  8: 'col-span-8',
  9: 'col-span-9',
  12: 'col-span-12',
};

export function Col({ span = 6, children }: { span?: number; children: ReactNode }) {
  return <div className={SPANS[span] ?? SPANS[6]}>{children}</div>;
}

/** Checkbox-style switch that also reads well inside the grid. */
export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex h-8 items-center gap-2 self-end">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 accent-brand-700"
      />
      <span className="text-sm text-ink">{label}</span>
      {hint && <span className="text-xs text-ink-subtle">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

const PHONE_OPTIONS: SelectOption<string>[] = PHONE_CODES.map((code) => ({
  value: code,
  label: code,
}));

export function PhoneField({
  label,
  code,
  digits,
  onCodeChange,
  onDigitsChange,
  error,
  required,
  id,
}: {
  label: string;
  code: string;
  digits: string;
  onCodeChange: (code: string) => void;
  onDigitsChange: (digits: string) => void;
  error?: string;
  required?: boolean;
  /** DOM id for the digits box, so a failed submit can focus it directly. */
  id?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-24 shrink-0">
        <Select
          label="Prefix"
          value={code}
          options={PHONE_OPTIONS}
          onChange={onCodeChange}
        />
      </div>
      <div className="flex-1">
        <TextInput
          id={id}
          label={label}
          required={required}
          inputMode="numeric"
          value={digits}
          error={error}
          placeholder="7XXXXXXXX"
          onChange={(event) => onDigitsChange(event.target.value.replace(/\D/g, ''))}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

/**
 * Address text plus optional manual coordinates.
 *
 * TODO(map): the mobile app picks the point on a MapView with reverse
 * geocoding and shows the client's existing placements as markers. The desktop
 * equivalent is a map picker in this slot — it needs a mapping library, which
 * is deliberately not installed yet, so for now the address is typed and the
 * coordinates are optional. Everything downstream already round-trips the
 * "lat,lng" string via parseCoordinates/formatCoordinates, so dropping a
 * picker in here is the only change needed.
 */
export function LocationFields({
  label,
  value,
  onChange,
  addressError,
  coordinatesError,
  required,
  addressId,
  coordinatesId,
}: {
  label: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  addressError?: string;
  coordinatesError?: string;
  required?: boolean;
  /** DOM ids matching the validator's error keys, for focus-on-failed-submit. */
  addressId?: string;
  coordinatesId?: string;
}) {
  const point = parseCoordinates(value.coordinates);
  return (
    <FormGrid>
      <Col span={8}>
        <TextInput
          id={addressId}
          label={label}
          required={required}
          value={value.address}
          error={addressError}
          placeholder="Str. Exemplu 12, București"
          onChange={(event) => onChange({ ...value, address: event.target.value })}
        />
      </Col>
      <Col span={4}>
        <TextInput
          id={coordinatesId}
          label="Coordonate (lat,lng)"
          value={value.coordinates}
          error={coordinatesError}
          hint={point ? `${point.lat}, ${point.lng}` : 'Opțional'}
          placeholder="44.4268,26.1025"
          onChange={(event) => onChange({ ...value, coordinates: event.target.value })}
        />
      </Col>
    </FormGrid>
  );
}
