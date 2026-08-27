/**
 * Form building blocks shared by the order and client drawers.
 *
 * Layout is desktop-first: a 12-column grid so a whole order fits in one
 * scannable form instead of the mobile app's four-screen wizard.
 */

import { Suspense, lazy, useState, type ReactNode } from 'react';
import {
  Autocomplete,
  Button,
  PinIcon,
  Select,
  TextInput,
  type AutocompleteOption,
  type SelectOption,
} from '@/components/ui';
import { parseCoordinates } from '@/types/domain';
import type { LocationValue } from '../orderModel';
import { PHONE_CODES } from '../validation';
import type { KnownPlace } from './LocationPickerModal';

/**
 * MapLibre is ~250 kB gzipped and reaching it eagerly from here would put it in
 * the Comenzi chunk for every operator, most of whom type the address and never
 * open the map. Loaded on the first click of `Alege pe hartă` instead — see the
 * header of LocationPickerModal.
 */
const LocationPickerModal = lazy(() =>
  import('./LocationPickerModal').then((module) => ({ default: module.LocationPickerModal })),
);

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
 * Address text plus optional manual coordinates, with a map picker beside them.
 *
 * When `suggestions` is supplied the address becomes a typeahead over places
 * this client (and then anyone) has been served before — the operator picks a
 * known site instead of retyping it, and accepting a suggestion carries its
 * "lat,lng" across too, via `coordinatesFor`. Free text is still allowed: the
 * list only offers shortcuts, it never constrains the value.
 *
 * `Alege pe hartă` opens the same drag-a-pin picker the mobile app has, and
 * writes both halves of the value at once. The typed fields stay: an operator
 * copying an address out of an email should not have to open a map, and the
 * coordinates box is still the fastest way to paste a point someone sent over
 * WhatsApp.
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
  suggestions,
  coordinatesFor,
  knownPlaces,
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
  /** Known addresses to offer as a typeahead. Omit for a plain text field. */
  suggestions?: AutocompleteOption[];
  /** "lat,lng" for an accepted suggestion, so the point comes with it. */
  coordinatesFor?: (option: AutocompleteOption) => string | null;
  /** The same known sites, as markers on the map picker. */
  knownPlaces?: readonly KnownPlace[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const point = parseCoordinates(value.coordinates);
  return (
    <FormGrid>
      <Col span={8}>
        {suggestions ? (
          <Autocomplete
            id={addressId}
            label={label}
            required={required}
            value={value.address}
            error={addressError}
            hint={
              value.address.trim() ? undefined : 'Scrie sau alege o adresă folosită anterior'
            }
            placeholder="Str. Exemplu 12, București"
            options={suggestions}
            onChange={(address) => onChange({ ...value, address })}
            onSelect={(option) =>
              onChange({
                address: option.value,
                coordinates: coordinatesFor?.(option) ?? value.coordinates,
              })
            }
          />
        ) : (
          <TextInput
            id={addressId}
            label={label}
            required={required}
            value={value.address}
            error={addressError}
            placeholder="Str. Exemplu 12, București"
            onChange={(event) => onChange({ ...value, address: event.target.value })}
          />
        )}
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
      <Col span={12}>
        <Button size="sm" icon={<PinIcon />} onClick={() => setPickerOpen(true)}>
          {point ? 'Ajustează pe hartă' : 'Alege pe hartă'}
        </Button>
      </Col>
      {/* Rendered only while open so the lazy chunk is fetched on the first
          click, not on every drawer that happens to contain a location. */}
      {pickerOpen && (
        <Suspense fallback={null}>
          <LocationPickerModal
            open
            label={label}
            value={value}
            knownPlaces={knownPlaces}
            onCancel={() => setPickerOpen(false)}
            onConfirm={(picked) => {
              setPickerOpen(false);
              onChange(picked);
            }}
          />
        </Suspense>
      )}
    </FormGrid>
  );
}
