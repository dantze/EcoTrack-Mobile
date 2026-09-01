/**
 * Create / edit a client, both shapes of the `Client` union in one drawer.
 *
 * Validation is the mobile app's (CreateClient / EditClient): email, phone and
 * address are always required, company records additionally need name, CUI and
 * administrator.
 *
 * **The ID photo upload that used to live here is gone (TODO-14).** An identity
 * document is now read on this machine by `IdScanField` and thrown away; the
 * two fields it yields are ordinary form values from that point on. There is no
 * longer anything to upload, which is the point — a photo that was never stored
 * cannot be read out of a bucket later.
 */

import { useState } from 'react';
import type { ClientInput } from '@/api';
import { Button, Drawer, TextInput } from '@/components/ui';
import type { Client } from '@/types/domain';
import { IdScanField } from '../idScan/IdScanField';
import type { MrzRead } from '../idScan/mrz';
import { useCreateClient, useUpdateClient } from '../queries';
import {
  focusFirstInvalidField,
  isValidEmail,
  isValidPhoneDigits,
  joinPhone,
  splitPhone,
} from '../validation';
import { Col, FormGrid, FormSection, PhoneField } from './fields';
import { errorMessage, toast } from './Toaster';

type ClientKind = 'individual' | 'company';

interface FormState {
  kind: ClientKind;
  fullName: string;
  cnp: string;
  companyName: string;
  cui: string;
  adminName: string;
  email: string;
  phoneCode: string;
  phoneDigits: string;
  address: string;
}

function initialState(client: Client | null): FormState {
  const phone = splitPhone(client?.phone);
  return {
    kind: client?.type ?? 'individual',
    fullName: client && client.type === 'individual' ? client.fullName : '',
    cnp: client && client.type === 'individual' ? (client.CNP ?? '') : '',
    companyName: client && client.type === 'company' ? client.name : '',
    cui: client && client.type === 'company' ? (client.CUI ?? '') : '',
    adminName: client && client.type === 'company' ? (client.adminName ?? '') : '',
    email: client?.email ?? '',
    phoneCode: phone.code,
    phoneDigits: phone.digits,
    address: client?.address ?? '',
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(state: FormState): Errors {
  const errors: Errors = {};
  if (!state.email.trim()) errors.email = 'Emailul este obligatoriu.';
  else if (!isValidEmail(state.email)) {
    errors.email = 'Adresa de email trebuie să fie în formatul exemplu@domeniu.ro.';
  }
  if (!state.phoneDigits.trim()) errors.phoneDigits = 'Telefonul este obligatoriu.';
  else if (!isValidPhoneDigits(state.phoneDigits)) {
    errors.phoneDigits = 'Numărul de telefon trebuie să conțină doar cifre (minim 4, maxim 15).';
  }
  if (!state.address.trim()) errors.address = 'Adresa este obligatorie.';

  if (state.kind === 'company') {
    if (!state.companyName.trim()) errors.companyName = 'Numele companiei este obligatoriu.';
    if (!state.cui.trim()) errors.cui = 'CUI este obligatoriu.';
    if (!state.adminName.trim()) errors.adminName = 'Numele administratorului este obligatoriu.';
  } else if (!state.fullName.trim()) {
    errors.fullName = 'Numele complet este obligatoriu.';
  }
  return errors;
}

function toInput(state: FormState): ClientInput {
  const shared = {
    email: state.email.trim(),
    phone: joinPhone(state.phoneCode, state.phoneDigits),
    address: state.address.trim(),
  };
  return state.kind === 'company'
    ? {
        type: 'company',
        name: state.companyName.trim(),
        CUI: state.cui.trim(),
        adminName: state.adminName.trim(),
        ...shared,
      }
    : {
        type: 'individual',
        fullName: state.fullName.trim(),
        CNP: state.cnp.trim() || null,
        ...shared,
      };
}

export function ClientFormDrawer({
  client = null,
  onClose,
  onCreated,
}: {
  client?: Client | null;
  onClose: () => void;
  /**
   * Fired after "Salvează și comandă" — the desktop version of the mobile
   * "Creare Comandă Client" button, which chained straight into an order.
   */
  onCreated?: (created: Client) => void;
}) {
  const editing = client !== null;
  const [state, setState] = useState<FormState>(() => initialState(client));
  const [errors, setErrors] = useState<Errors>({});

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const patch = (changes: Partial<FormState>) =>
    setState((current) => ({ ...current, ...changes }));

  /**
   * Fill the two fields a scan yields. Fills, never commits — the operator sees
   * the values in the inputs and saves (or fixes) them like any other typing.
   */
  const applyScan = (read: MrzRead) => {
    setState((current) => ({
      ...current,
      fullName: read.fullName,
      // A document that carries no CNP must not wipe one already typed. Only a
      // CNP the parser actually verified is allowed to overwrite anything.
      cnp: read.cnp ?? current.cnp,
    }));
    setErrors((current) => ({ ...current, fullName: undefined, cnp: undefined }));
  };

  const saving = createClient.isPending || updateClient.isPending;

  const submit = async (chainOrder = false) => {
    const found = validate(state);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Verificați câmpurile marcate.');
      focusFirstInvalidField(found);
      return;
    }

    const input = toInput(state);
    try {
      const saved = editing && client
        ? await updateClient.mutateAsync({ id: client.id, input })
        : await createClient.mutateAsync(input);

      toast.success(editing ? 'Clientul a fost actualizat.' : 'Clientul a fost creat.');
      if (!editing && chainOrder) onCreated?.(saved);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'Nu s-a putut salva clientul'));
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={editing ? 'Editare client' : 'Client nou'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Anulează
          </Button>
          {!editing && onCreated && (
            <Button variant="secondary" disabled={saving} onClick={() => void submit(true)}>
              Salvează și comandă
            </Button>
          )}
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {editing ? 'Salvează' : 'Creează client'}
          </Button>
        </>
      }
    >
      <FormSection title="Tip client">
        {editing ? (
          <p className="text-sm text-ink">
            {state.kind === 'company' ? 'Persoană juridică (PJ)' : 'Persoană fizică (PF)'}
          </p>
        ) : (
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(['individual', 'company'] as ClientKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => patch({ kind })}
                className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                  state.kind === kind
                    ? 'bg-brand-700 text-white'
                    : 'text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                {kind === 'company' ? 'Persoană juridică' : 'Persoană fizică'}
              </button>
            ))}
          </div>
        )}
      </FormSection>

      <FormSection title="Identificare">
        {state.kind === 'individual' && (
          <div className="mb-4">
            <IdScanField onRead={applyScan} />
          </div>
        )}
        <FormGrid>
          {state.kind === 'individual' ? (
            <>
              <Col span={8}>
                <TextInput
                  id="fullName"
                  label="Nume complet"
                  required
                  value={state.fullName}
                  error={errors.fullName}
                  onChange={(event) => patch({ fullName: event.target.value })}
                />
              </Col>
              <Col span={4}>
                <TextInput
                  label="CNP"
                  hint="Opțional"
                  inputMode="numeric"
                  value={state.cnp}
                  error={errors.cnp}
                  onChange={(event) => patch({ cnp: event.target.value.replace(/\D/g, '') })}
                />
              </Col>
            </>
          ) : (
            <>
              <Col span={6}>
                <TextInput
                  id="companyName"
                  label="Nume companie"
                  required
                  value={state.companyName}
                  error={errors.companyName}
                  onChange={(event) => patch({ companyName: event.target.value })}
                />
              </Col>
              <Col span={3}>
                <TextInput
                  id="cui"
                  label="CUI"
                  required
                  value={state.cui}
                  error={errors.cui}
                  onChange={(event) => patch({ cui: event.target.value })}
                />
              </Col>
              <Col span={3}>
                <TextInput
                  id="adminName"
                  label="Administrator"
                  required
                  value={state.adminName}
                  error={errors.adminName}
                  onChange={(event) => patch({ adminName: event.target.value })}
                />
              </Col>
            </>
          )}
        </FormGrid>
      </FormSection>

      <FormSection title="Contact">
        <FormGrid>
          <Col span={6}>
            <TextInput
              id="email"
              label="Email"
              required
              type="email"
              value={state.email}
              error={errors.email}
              onChange={(event) => patch({ email: event.target.value })}
            />
          </Col>
          <Col span={6}>
            <PhoneField
              id="phoneDigits"
              label="Telefon"
              required
              code={state.phoneCode}
              digits={state.phoneDigits}
              error={errors.phoneDigits}
              onCodeChange={(phoneCode) => patch({ phoneCode })}
              onDigitsChange={(phoneDigits) => patch({ phoneDigits })}
            />
          </Col>
          <Col span={12}>
            <TextInput
              id="address"
              label="Adresă"
              required
              value={state.address}
              error={errors.address}
              onChange={(event) => patch({ address: event.target.value })}
            />
          </Col>
        </FormGrid>
      </FormSection>

    </Drawer>
  );
}
