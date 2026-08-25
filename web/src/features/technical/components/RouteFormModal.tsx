/**
 * Create-route dialog.
 *
 * Mirrors the mobile CreateRoute screen's validation (name, weekday and county
 * are all required there) and adds the concrete date + driver the desktop
 * dispatch board sorts by. Picking a date fills the weekday automatically.
 */

import { useEffect, useState } from 'react';
import { Button, DateInput, Modal, Select, TextInput } from '@/components/ui';
import type { CreateRouteInput } from '@/api';
import type { Employee } from '@/types/domain';
import { COUNTY_OPTIONS, WEEKDAY_OPTIONS } from '../constants';
import { focusFirstInvalidField } from '../utils';

export interface RouteFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateRouteInput) => void;
  submitting?: boolean;
  drivers: Employee[] | undefined;
  /** Pre-fills the date field, usually the date the board is filtered to. */
  defaultDate?: string | null;
}

interface Errors {
  name?: string;
  county?: string;
  dayOfWeek?: string;
}

/** ISO "YYYY-MM-DD" → 1 = Monday … 7 = Sunday. */
function weekdayFromIso(iso: string): number | null {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const jsDay = parsed.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function RouteFormModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  drivers,
  defaultDate = null,
}: RouteFormModalProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState<string | null>(defaultDate);
  const [dayOfWeek, setDayOfWeek] = useState<string | null>(null);
  const [county, setCounty] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  // Reset every time the dialog opens so a cancelled draft never leaks back.
  useEffect(() => {
    if (!open) return;
    setName('');
    setDate(defaultDate);
    setDayOfWeek(defaultDate ? String(weekdayFromIso(defaultDate) ?? '') || null : null);
    setCounty(null);
    setEmployeeId(null);
    setErrors({});
  }, [open, defaultDate]);

  const handleDateChange = (value: string | null) => {
    setDate(value);
    if (value) {
      const derived = weekdayFromIso(value);
      if (derived) setDayOfWeek(String(derived));
    }
  };

  const submit = () => {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Numele rutei este obligatoriu.';
    if (!county) next.county = 'Alege județul.';
    if (!dayOfWeek) next.dayOfWeek = 'Alege ziua săptămânii.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstInvalidField(next);
      return;
    }

    onSubmit({
      name: name.trim(),
      date,
      dayOfWeek: dayOfWeek ? Number(dayOfWeek) : null,
      county,
      employeeId: employeeId ? Number(employeeId) : null,
    });
  };

  const driverOptions = (drivers ?? []).map((driver) => ({
    value: String(driver.id),
    label: driver.fullName,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rută nouă"
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Anulează
          </Button>
          <Button variant="primary" onClick={submit} loading={submitting}>
            Creează ruta
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextInput
          id="name"
          label="Nume rută"
          required
          placeholder="ex: Ruta Cluj Vest"
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <DateInput label="Data" value={date} onChange={handleDateChange} />
          <Select
            id="dayOfWeek"
            label="Ziua săptămânii"
            required
            value={dayOfWeek}
            options={WEEKDAY_OPTIONS}
            error={errors.dayOfWeek}
            onChange={setDayOfWeek}
          />
        </div>

        <Select
          id="county"
          label="Județ"
          required
          searchable
          value={county}
          options={COUNTY_OPTIONS}
          error={errors.county}
          onChange={setCounty}
        />

        <Select
          label="Șofer"
          hint="Poate fi asignat și mai târziu."
          searchable
          value={employeeId}
          options={driverOptions}
          placeholder="Fără șofer"
          onChange={setEmployeeId}
        />
      </div>
    </Modal>
  );
}
