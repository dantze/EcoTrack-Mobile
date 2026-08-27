/**
 * Create-route dialog.
 *
 * Mirrors the mobile CreateRoute screen's validation: name, weekday and county
 * are all required, plus the driver the desktop dispatch board sorts by.
 *
 * There is no date field. A route is WEEKLY — it recurs on its weekday, and
 * editing it changes every week from now on — so asking for a calendar date
 * would be asking a question the domain cannot answer.
 */

import { useEffect, useState } from 'react';
import { Button, Modal, Select, TextInput } from '@/components/ui';
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
}

interface Errors {
  name?: string;
  county?: string;
  dayOfWeek?: string;
}

/** ISO "YYYY-MM-DD" → 1 = Monday … 7 = Sunday. */

export function RouteFormModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  drivers,
}: RouteFormModalProps) {
  const [name, setName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<string | null>(null);
  const [county, setCounty] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  // Reset every time the dialog opens so a cancelled draft never leaks back.
  useEffect(() => {
    if (!open) return;
    setName('');
    setDayOfWeek(null);
    setCounty(null);
    setEmployeeId(null);
    setErrors({});
  }, [open]);

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
