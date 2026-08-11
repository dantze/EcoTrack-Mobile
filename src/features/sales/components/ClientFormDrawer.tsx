/**
 * Create / edit a client, both shapes of the `Client` union in one drawer.
 *
 * Validation is the mobile app's (CreateClient / EditClient): email, phone and
 * address are always required, company records additionally need name, CUI and
 * administrator. The ID photo is uploaded after the record exists, exactly like
 * the original — there is no create-with-photo endpoint.
 */

import { useState } from 'react';
import type { ClientInput } from '@/api';
import { Button, Drawer, TextInput } from '@/components/ui';
import type { Client } from '@/types/domain';
import {
  useCreateClient,
  useDeleteIdPhoto,
  useUpdateClient,
  useUploadIdPhoto,
} from '../queries';
import {
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const uploadPhoto = useUploadIdPhoto();
  const deletePhoto = useDeleteIdPhoto();

  const existingPhotoUrl =
    client && client.type === 'individual' ? client.idPhotoUrl : null;

  const patch = (changes: Partial<FormState>) =>
    setState((current) => ({ ...current, ...changes }));

  const saving = createClient.isPending || updateClient.isPending || uploadPhoto.isPending;

  const submit = async (chainOrder = false) => {
    const found = validate(state);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Verificați câmpurile marcate.');
      return;
    }

    const input = toInput(state);
    try {
      const saved = editing && client
        ? await updateClient.mutateAsync({ id: client.id, input })
        : await createClient.mutateAsync(input);

      if (photoFile && saved.type === 'individual') {
        try {
          await uploadPhoto.mutateAsync({ clientId: saved.id, file: photoFile });
        } catch (photoError) {
          toast.error(
            errorMessage(
              photoError,
              'Clientul a fost salvat, dar poza de buletin nu a putut fi încărcată',
            ),
          );
          onClose();
          return;
        }
      }

      toast.success(editing ? 'Clientul a fost actualizat.' : 'Clientul a fost creat.');
      if (!editing && chainOrder) onCreated?.(saved);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'Nu s-a putut salva clientul'));
    }
  };

  const removePhoto = async () => {
    if (!client) return;
    try {
      await deletePhoto.mutateAsync(client.id);
      toast.success('Poza de buletin a fost ștearsă.');
    } catch (error) {
      toast.error(errorMessage(error, 'Nu s-a putut șterge poza'));
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
        <FormGrid>
          {state.kind === 'individual' ? (
            <>
              <Col span={8}>
                <TextInput
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
                  label="Nume companie"
                  required
                  value={state.companyName}
                  error={errors.companyName}
                  onChange={(event) => patch({ companyName: event.target.value })}
                />
              </Col>
              <Col span={3}>
                <TextInput
                  label="CUI"
                  required
                  value={state.cui}
                  error={errors.cui}
                  onChange={(event) => patch({ cui: event.target.value })}
                />
              </Col>
              <Col span={3}>
                <TextInput
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
              label="Adresă"
              required
              value={state.address}
              error={errors.address}
              onChange={(event) => patch({ address: event.target.value })}
            />
          </Col>
        </FormGrid>
      </FormSection>

      {state.kind === 'individual' && (
        <FormSection
          title="Buletin"
          description="Fără cameră pe desktop — încărcați o fotografie sau un scan al actului."
        >
          <div className="flex items-start gap-4">
            {existingPhotoUrl && (
              <div className="flex flex-col items-start gap-1">
                <img
                  src={existingPhotoUrl}
                  alt="Buletin"
                  className="h-24 w-36 rounded border border-border object-cover"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  loading={deletePhoto.isPending}
                  onClick={() => void removePhoto()}
                >
                  Șterge imaginea
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                className="text-sm text-ink-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-white file:px-2.5 file:py-1 file:text-sm file:text-ink hover:file:bg-surface-sunken"
              />
              <p className="text-xs text-ink-subtle">
                {photoFile
                  ? `Se va încărca: ${photoFile.name}`
                  : editing
                    ? 'Alegeți un fișier pentru a înlocui imaginea.'
                    : 'Imaginea se încarcă după crearea clientului.'}
              </p>
            </div>
          </div>
        </FormSection>
      )}
    </Drawer>
  );
}
