/**
 * Abonamente — the product catalogue. Create and edit happen in a modal.
 *
 * There is deliberately NO active/inactive UI. `Subscription.isActive` is a
 * SOFT-DELETE flag, not a status: `DELETE /api/subscriptions/{id}` sets it to
 * false so retired plans stop appearing in new-order dropdowns while old
 * orders that reference them keep resolving. Surfacing that as a toggle made
 * the catalogue look like something with a lifecycle to manage, which it is
 * not — you either sell a plan or you retire it.
 *
 * The list therefore shows only live plans; deleting one retires it.
 */

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  type Column,
  type SelectOption,
} from '@/components/ui';
import { formatMoney } from '@/components/domain';
import { SUBSCRIPTION_TYPES, type Subscription, type SubscriptionType } from '@/types/domain';
import { includesFolded } from '@/lib/search';
import { ErrorNotice, FilterBar, FilterField, SearchInput } from './components/FilterBar';
import { ToggleField } from './components/fields';
import { Toaster, errorMessage, toast } from './components/Toaster';
import { useConfirm } from './components/useConfirm';
import {
  useCreateSubscription,
  useDeleteSubscription,
  useSubscriptions,
  useUpdateSubscription,
  type SubscriptionInput,
} from './queries';
import {
  focusFirstInvalidField,
  parseDecimal,
  validatePositiveInt,
  validatePositiveNumber,
  validateRequired,
} from './validation';

export const SUBSCRIPTION_TYPE_LABELS: Record<SubscriptionType, string> = {
  ONE_TIME: 'O singură dată',
  RECURRING: 'Recurent',
};

const TYPE_OPTIONS: SelectOption<string>[] = SUBSCRIPTION_TYPES.map((type) => ({
  value: type,
  label: SUBSCRIPTION_TYPE_LABELS[type],
}));

interface Draft {
  name: string;
  description: string;
  type: SubscriptionType;
  price: string;
  visitsPerMonth: string;
  durationMonths: string;
  isIndefinite: boolean;
  isActive: boolean;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  type: 'ONE_TIME',
  price: '',
  visitsPerMonth: '',
  durationMonths: '',
  isIndefinite: false,
  isActive: true,
};

function draftFrom(subscription: Subscription): Draft {
  return {
    name: subscription.name,
    description: subscription.description ?? '',
    type: subscription.type,
    price: subscription.price === null ? '' : String(subscription.price),
    visitsPerMonth: subscription.visitsPerMonth?.toString() ?? '',
    durationMonths: subscription.durationMonths?.toString() ?? '',
    isIndefinite: subscription.isIndefinite ?? false,
    isActive: subscription.isActive,
  };
}

/** Field-keyed so each box gets its own inline message instead of one toast. */
interface DraftErrors {
  name?: string;
  price?: string;
  visitsPerMonth?: string;
}

function validateDraft(draft: Draft): DraftErrors {
  const errors: DraftErrors = {};
  const nameError = validateRequired(draft.name, 'Numele abonamentului');
  if (nameError) errors.name = nameError;
  const priceError = validatePositiveNumber(draft.price, 'Prețul');
  if (priceError) errors.price = priceError;
  if (draft.type === 'RECURRING') {
    const visitsError = validatePositiveInt(draft.visitsPerMonth, 'Numărul de vizite/lună');
    if (visitsError) errors.visitsPerMonth = visitsError;
  }
  return errors;
}

function hasDraftErrors(errors: DraftErrors): boolean {
  return Object.values(errors).some(Boolean);
}

function toInput(draft: Draft): SubscriptionInput {
  const recurring = draft.type === 'RECURRING';
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    type: draft.type,
    price: parseDecimal(draft.price),
    visitsPerMonth: recurring ? Number.parseInt(draft.visitsPerMonth, 10) : null,
    durationMonths:
      recurring && !draft.isIndefinite && draft.durationMonths.trim()
        ? Number.parseInt(draft.durationMonths, 10)
        : null,
    isIndefinite: recurring ? draft.isIndefinite : null,
    isActive: draft.isActive,
  };
}


export function SubscriptionsPage() {
  const subscriptionsQuery = useSubscriptions(true);
  const createSubscription = useCreateSubscription();
  const updateSubscription = useUpdateSubscription();
  const deleteSubscription = useDeleteSubscription();
  const { confirm, confirmDialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});

  const subscriptions = useMemo(
    () => subscriptionsQuery.data ?? [],
    [subscriptionsQuery.data],
  );

  const rows = useMemo(() => {
    const needle = search.trim();
    return subscriptions.filter((subscription) => {
      // Retired plans are soft-deleted, so they simply do not appear.
      if (!subscription.isActive) return false;
      if (!needle) return true;
      // Diacritic-insensitive, like every other search box in the app.
      return includesFolded(`${subscription.name} ${subscription.description ?? ''}`, needle);
    });
  }, [subscriptions, search]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT });
    setDraftErrors({});
  };

  const openEdit = (subscription: Subscription) => {
    setEditing(subscription);
    setDraft(draftFrom(subscription));
    setDraftErrors({});
  };

  const closeModal = () => {
    setEditing(null);
    setDraft(null);
    setDraftErrors({});
  };

  const save = async () => {
    if (!draft) return;
    const found = validateDraft(draft);
    setDraftErrors(found);
    if (hasDraftErrors(found)) {
      toast.error('Verificați câmpurile marcate.');
      focusFirstInvalidField(found);
      return;
    }
    try {
      if (editing) {
        await updateSubscription.mutateAsync({ id: editing.id, input: toInput(draft) });
        toast.success('Abonamentul a fost actualizat.');
      } else {
        await createSubscription.mutateAsync(toInput(draft));
        toast.success('Abonamentul a fost adăugat.');
      }
      closeModal();
    } catch (mutationError) {
      toast.error(errorMessage(mutationError, 'Nu s-a putut salva abonamentul'));
    }
  };

  const remove = async (subscription: Subscription) => {
    const confirmed = await confirm({
      title: 'Șterge abonamentul?',
      body: `„${subscription.name}” va fi șters definitiv.`,
      confirmLabel: 'Șterge',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteSubscription.mutateAsync(subscription.id);
      toast.success('Abonamentul a fost șters.');
    } catch (error) {
      toast.error(errorMessage(error, 'Nu s-a putut șterge abonamentul'));
    }
  };

  const columns: Column<Subscription>[] = [
    {
      key: 'name',
      header: 'Nume',
      width: '18rem',
      sortValue: (subscription) => subscription.name.toLowerCase(),
      render: (subscription) => <span className="font-medium">{subscription.name}</span>,
    },
    {
      key: 'type',
      header: 'Tip',
      width: '9rem',
      sortValue: (subscription) => subscription.type,
      render: (subscription) => (
        <Badge tone={subscription.type === 'RECURRING' ? 'info' : 'neutral'}>
          {SUBSCRIPTION_TYPE_LABELS[subscription.type]}
        </Badge>
      ),
    },
    {
      key: 'description',
      header: 'Descriere',
      sortValue: (subscription) => (subscription.description ?? '').toLowerCase(),
      render: (subscription) => (
        <span className="block max-w-[24rem] truncate text-ink-muted">
          {subscription.description ?? '—'}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Preț',
      width: '8rem',
      align: 'right',
      sortValue: (subscription) => subscription.price,
      render: (subscription) => <span className="tabular">{formatMoney(subscription.price)}</span>,
    },
    {
      key: 'visits',
      header: 'Vizite/lună',
      width: '7rem',
      align: 'right',
      sortValue: (subscription) => subscription.visitsPerMonth,
      render: (subscription) => (
        <span className="tabular">{subscription.visitsPerMonth ?? '—'}</span>
      ),
    },
    {
      key: 'duration',
      header: 'Durată',
      width: '9rem',
      sortValue: (subscription) =>
        subscription.isIndefinite ? Number.MAX_SAFE_INTEGER : subscription.durationMonths,
      render: (subscription) =>
        subscription.isIndefinite
          ? 'Nedeterminat'
          : subscription.durationMonths
            ? `${subscription.durationMonths} luni`
            : '—',
    },
    {
      key: 'actions',
      header: '',
      width: '11rem',
      align: 'right',
      render: (subscription) => (
        <span
          role="presentation"
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <Button size="sm" variant="ghost" onClick={() => openEdit(subscription)}>
            Editează
          </Button>
          <button
            type="button"
            className="px-1.5 text-xs font-medium text-red-600 hover:underline"
            onClick={() => void remove(subscription)}
          >
            Șterge
          </button>
        </span>
      ),
    },
  ];

  const saving = createSubscription.isPending || updateSubscription.isPending;
  const filtersActive = search !== '';
  const resetFilters = () => setSearch('');

  return (
    <>
      <PageHeader
        title="Abonamente"
        subtitle={
          subscriptionsQuery.isLoading
            ? 'Se încarcă…'
            : `${rows.length} din ${subscriptions.length} abonamente`
        }
        actions={
          <>
            <Button
              variant="secondary"
              loading={subscriptionsQuery.isFetching}
              onClick={() => void subscriptionsQuery.refetch()}
            >
              Reîmprospătează
            </Button>
            <Button variant="primary" onClick={openCreate}>
              + Abonament
            </Button>
          </>
        }
      />

      <FilterBar>
        <FilterField label="Căutare">
          <SearchInput value={search} onChange={setSearch} placeholder="Nume sau descriere" />
        </FilterField>
      </FilterBar>

      {subscriptionsQuery.isError ? (
        <ErrorNotice
          message="Nu s-au putut prelua abonamentele."
          onRetry={() => void subscriptionsQuery.refetch()}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(subscription) => subscription.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          loading={subscriptionsQuery.isLoading}
          activeKey={editing?.id ?? null}
          onRowClick={openEdit}
          empty={
            <EmptyState
              title={filtersActive ? 'Niciun abonament pentru filtrele curente' : 'Nu există abonamente'}
              body={
                filtersActive
                  ? 'Modifică fila sau căutarea, ori resetează filtrele.'
                  : 'Adăugați primul abonament pentru comenzile de igienizare.'
              }
              action={
                filtersActive ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Resetează filtrele
                  </Button>
                ) : (
                  <Button variant="primary" onClick={openCreate}>
                    + Abonament
                  </Button>
                )
              }
            />
          }
        />
      )}

      <Modal
        open={draft !== null}
        onClose={closeModal}
        width="md"
        title={editing ? 'Editare abonament' : 'Abonament nou'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Anulează
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void save()}>
              {editing ? 'Salvează' : 'Adaugă'}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-8">
              <TextInput
                id="name"
                label="Nume abonament"
                required
                value={draft.name}
                error={draftErrors.name}
                placeholder="Ex: Igienizare lunară"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
            <div className="col-span-4">
              <TextInput
                id="price"
                label="Preț (RON)"
                required
                inputMode="decimal"
                value={draft.price}
                error={draftErrors.price}
                onChange={(event) =>
                  setDraft({ ...draft, price: event.target.value.replace(/[^\d.,]/g, '') })
                }
              />
            </div>
            <div className="col-span-12">
              <TextArea
                label="Descriere"
                value={draft.description}
                placeholder="Opțional"
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>
            <div className="col-span-6">
              <Select
                label="Tip"
                required
                value={draft.type}
                options={TYPE_OPTIONS}
                onChange={(value) =>
                  setDraft({ ...draft, type: value === 'RECURRING' ? 'RECURRING' : 'ONE_TIME' })
                }
              />
            </div>
            <div className="col-span-6">
              <ToggleField
                label="Activ"
                checked={draft.isActive}
                onChange={(isActive) => setDraft({ ...draft, isActive })}
              />
            </div>

            {draft.type === 'RECURRING' && (
              <>
                <div className="col-span-4">
                  <TextInput
                    id="visitsPerMonth"
                    label="Vizite pe lună"
                    required
                    inputMode="numeric"
                    value={draft.visitsPerMonth}
                    error={draftErrors.visitsPerMonth}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        visitsPerMonth: event.target.value.replace(/\D/g, ''),
                      })
                    }
                  />
                </div>
                <div className="col-span-4">
                  <TextInput
                    label="Durată (luni)"
                    inputMode="numeric"
                    disabled={draft.isIndefinite}
                    value={draft.isIndefinite ? '' : draft.durationMonths}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        durationMonths: event.target.value.replace(/\D/g, ''),
                      })
                    }
                  />
                </div>
                <div className="col-span-4">
                  <ToggleField
                    label="Nedeterminat"
                    checked={draft.isIndefinite}
                    onChange={(isIndefinite) =>
                      setDraft({
                        ...draft,
                        isIndefinite,
                        durationMonths: isIndefinite ? '' : draft.durationMonths,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {confirmDialog}
      <Toaster />
    </>
  );
}
