/**
 * Angajați — everyone in the system, and what they are allowed to do.
 *
 * This is where an admin promotes someone (including to ADMIN) or demotes
 * them. Two things worth knowing:
 *
 *   - Changing a role REVOKES that person's sessions server-side. That is
 *     deliberate: a demotion that left the old device running under the old
 *     role would not be a demotion.
 *   - The last remaining admin cannot be demoted or deleted. With no password
 *     anywhere in the system, zero admins means nobody can ever approve an
 *     access request again and the instance is unrecoverable.
 *
 * It replaces the old Tehnic → Șoferi screen, which was a driver-only roster.
 */

import { useMemo, useState } from 'react';
import { CommandBar, Workbench } from '@/components/layout';
import {
  Badge,
  DataTable,
  EmptyState,
  IconButton,
  Select,
  Spinner,
  TextInput,
  useConfirm,
  useToast,
} from '@/components/ui';
import { ROLE_LABELS } from '@/components/domain';
import type { Employee, Role } from '@/types/domain';
import { useAuth } from '@/auth';
import { useAllEmployees, useRemoveEmployee, useSetEmployeeRoles } from './queries';

const ASSIGNABLE: Role[] = ['DRIVER', 'SALES', 'TECH', 'ADMIN'];

export function EmployeesPage() {
  const { user } = useAuth();
  const { data, isLoading } = useAllEmployees();
  const setRoles = useSetEmployeeRoles();
  const removeEmployee = useRemoveEmployee();
  const toast = useToast();
  const confirm = useConfirm();

  const [query, setQuery] = useState('');
  const employees = useMemo(() => data ?? [], [data]);

  const adminCount = useMemo(
    () => employees.filter((employee) => employee.roles.includes('ADMIN')).length,
    [employees],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter(
      (employee) =>
        employee.fullName.toLowerCase().includes(needle) ||
        employee.username.toLowerCase().includes(needle),
    );
  }, [employees, query]);

  /**
   * The lockout guard. `isLastAdmin` is the only reason a role change is ever
   * refused client-side — the server has the same rule, this just explains it
   * before the user tries.
   */
  function isLastAdmin(employee: Employee): boolean {
    return employee.roles.includes('ADMIN') && adminCount <= 1;
  }

  function changeRole(employee: Employee, role: Role) {
    if (isLastAdmin(employee) && role !== 'ADMIN') {
      toast.error('Nu poți retrage rolul ultimului administrator.');
      return;
    }
    setRoles.mutate(
      { id: employee.id, roles: [role] },
      {
        onSuccess: () => toast.success(`${employee.fullName}: ${ROLE_LABELS[role]}.`),
        onError: () => toast.error('Schimbarea rolului a eșuat.'),
      },
    );
  }

  async function remove(employee: Employee) {
    if (isLastAdmin(employee)) {
      toast.error('Nu poți șterge ultimul administrator.');
      return;
    }
    const ok = await confirm({
      title: 'Șterge angajatul',
      body: `${employee.fullName} va pierde accesul la aplicație.`,
      confirmLabel: 'Șterge',
      destructive: true,
    });
    if (!ok) return;
    removeEmployee.mutate(employee.id, {
      onSuccess: () => toast.success('Angajatul a fost șters.'),
      onError: () => toast.error('Ștergerea a eșuat.'),
    });
  }

  return (
    <Workbench>
      <CommandBar
        title="Angajați"
        subtitle={`${employees.length} persoane cu acces · rolul decide ce pot face`}
        tools={
          <div className="w-48 sm:w-64">
            <TextInput
              placeholder="Caută după nume sau utilizator"
              value={query}
              inputSize="sm"
              clearable
              onClear={() => setQuery('')}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-6 text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Niciun angajat"
          body="Angajații apar aici după ce le aprobi cererea de acces."
        />
      ) : (
        <DataTable
          rows={filtered}
          ariaLabel="Angajați"
          rowKey={(employee) => employee.id}
          columns={[
            {
              key: 'name',
              header: 'Nume',
              render: (employee) => (
                <div>
                  <p className="font-medium text-ink">{employee.fullName}</p>
                  <p className="text-xs text-ink-muted">{employee.username}</p>
                </div>
              ),
            },
            {
              key: 'roles',
              header: 'Roluri',
              render: (employee) => (
                <div className="flex flex-wrap gap-1">
                  {employee.roles.map((role) => (
                    <Badge key={role} tone={role === 'ADMIN' ? 'warning' : 'neutral'}>
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                </div>
              ),
            },
            {
              key: 'change',
              header: 'Schimbă rolul',
              render: (employee) => (
                <Select
                  label=""
                  value={employee.roles[0] ?? 'DRIVER'}
                  onChange={(next) => changeRole(employee, next as Role)}
                  options={ASSIGNABLE.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                  className="w-40"
                />
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (employee) => (
                <IconButton
                  label="Șterge angajatul"
                  disabled={employee.id === user?.id || isLastAdmin(employee)}
                  onClick={() => void remove(employee)}
                >
                  ✕
                </IconButton>
              ),
            },
          ]}
        />
      )}
    </Workbench>
  );
}
