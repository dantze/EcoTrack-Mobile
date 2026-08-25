/**
 * Create / edit an employee.
 *
 * These are the only screens in the Technical module that hit `/api/admin/**`,
 * which requires the admin role on the caller's Bearer token. When the
 * signed-in account lacks that role the backend answers 401/403 — the dialog
 * surfaces that as a plain Romanian explanation instead of letting the error
 * bubble out.
 */

import { useEffect, useState } from 'react';
import { Button, Checkbox, Modal, Select, TextInput } from '@/components/ui';
import type { CreateEmployeeInput } from '@/api';
import { ROLE_LABELS } from '@/components/domain';
import { ROLES } from '@/types/domain';
import type { Employee, Role } from '@/types/domain';
import { COUNTY_OPTIONS } from '../constants';
import { errorMessage, focusFirstInvalidField, isAdminAuthError } from '../utils';

export interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = create, otherwise edit. */
  employee: Employee | null;
  submitting: boolean;
  error: unknown;
  onSubmit: (input: CreateEmployeeInput, isEdit: boolean) => void;
}

interface Errors {
  fullName?: string;
  username?: string;
  password?: string;
  roles?: string;
}

export function EmployeeFormModal({
  open,
  onClose,
  employee,
  submitting,
  error,
  onSubmit,
}: EmployeeFormModalProps) {
  const isEdit = employee !== null;

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [county, setCounty] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>(['DRIVER']);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!open) return;
    setFullName(employee?.fullName ?? '');
    setUsername(employee?.username ?? '');
    setPassword('');
    setPhone(employee?.phone ?? '');
    setCounty(employee?.county ?? null);
    setRoles(employee?.roles?.length ? employee.roles : ['DRIVER']);
    setErrors({});
  }, [open, employee]);

  const toggleRole = (role: Role, checked: boolean) => {
    setRoles((current) =>
      checked ? [...new Set([...current, role])] : current.filter((item) => item !== role),
    );
  };

  const submit = () => {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = 'Numele este obligatoriu.';
    if (!username.trim()) next.username = 'Utilizatorul este obligatoriu.';
    if (!isEdit && password.trim().length < 4) next.password = 'Minim 4 caractere.';
    if (roles.length === 0) next.roles = 'Alege cel puțin un rol.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstInvalidField(next);
      return;
    }

    onSubmit(
      {
        username: username.trim(),
        // On edit an empty box means "keep the current password".
        password: password.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        county,
        roles,
      },
      isEdit,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Editează ${employee?.fullName}` : 'Angajat nou'}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Anulează
          </Button>
          <Button variant="primary" onClick={submit} loading={submitting}>
            {isEdit ? 'Salvează' : 'Creează'}
          </Button>
        </>
      }
    >
      {error !== null && error !== undefined && (
        <div
          role="alert"
          className={`mb-3 rounded-md border px-3 py-2 text-sm ${
            isAdminAuthError(error)
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {errorMessage(error)}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <TextInput
          id="fullName"
          label="Nume complet"
          required
          value={fullName}
          error={errors.fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            id="username"
            label="Utilizator"
            required
            autoComplete="off"
            value={username}
            error={errors.username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextInput
            id="password"
            label="Parolă"
            type="password"
            autoComplete="new-password"
            required={!isEdit}
            hint={isEdit ? 'Lasă gol pentru a păstra parola.' : undefined}
            value={password}
            error={errors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Telefon"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Select
            label="Județ"
            searchable
            value={county}
            options={COUNTY_OPTIONS}
            placeholder="Fără județ"
            onChange={setCounty}
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-ink-muted">Roluri</p>
          <div className="flex gap-4">
            {ROLES.map((role) => (
              <Checkbox
                key={role}
                checked={roles.includes(role)}
                label={ROLE_LABELS[role]}
                onChange={(checked) => toggleRole(role, checked)}
              />
            ))}
          </div>
          {errors.roles && <p className="mt-1 text-xs text-red-600">{errors.roles}</p>}
        </div>
      </div>
    </Modal>
  );
}
