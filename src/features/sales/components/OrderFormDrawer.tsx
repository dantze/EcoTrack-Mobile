/**
 * Create / edit an order — one dense form, not a wizard.
 *
 * The mobile app walks through four screens (pick client → pick type → subtype
 * form → submit). On a desktop the whole thing fits in a single slide-over with
 * the orders table still visible behind it, so client, type and the
 * subtype-specific fields are all on screen at once.
 *
 * Mount this only while it is open and give it a `key` — it seeds its state
 * once from props and never re-syncs.
 */

import { useMemo, useState } from 'react';
import {
  Button,
  DateInput,
  Drawer,
  Select,
  Spinner,
  TextArea,
  TextInput,
  type SelectOption,
} from '@/components/ui';
import { ORDER_TYPE_LABELS, formatMoney } from '@/components/domain';
import {
  ORDER_TYPES,
  type Client,
  type Order,
  type OrderTypeTag,
  clientName,
} from '@/types/domain';
import {
  FREQUENCY_OPTIONS,
  type OrderFormErrors,
  type OrderFormState,
  type PacketGroup,
  buildAmplasarePayload,
  buildIgienizarePayload,
  buildPacketGroups,
  buildRecurringPlanInput,
  buildRidicarePayloads,
  buildRidicareUpdatePayload,
  emptyOrderForm,
  hasErrors,
  isRidicare,
  orderToForm,
  subscriptionLabel,
  validateOrderForm,
} from '../orderModel';
import {
  useClientOrders,
  useClients,
  useCreateOrders,
  useCreateRecurringPlan,
  useOrderTaskStatuses,
  useProducts,
  useSubscriptions,
  useUpdateOrder,
} from '../queries';
import { ClientPicker } from './ClientPicker';
import { Col, FormGrid, FormSection, LocationFields, PhoneField, ToggleField } from './fields';
import { errorMessage, toast } from './Toaster';

const QUANTITY_OPTIONS: SelectOption<string>[] = Array.from({ length: 20 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

const IGIENIZARI_OPTIONS: SelectOption<string>[] = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

const FREQUENCY_SELECT: SelectOption<string>[] = FREQUENCY_OPTIONS;

interface OrderFormDrawerProps {
  /** Present → edit mode. The client and the order type are then fixed. */
  order?: Order | null;
  initialClient?: Client | null;
  onClose: () => void;
}

export function OrderFormDrawer({ order = null, initialClient = null, onClose }: OrderFormDrawerProps) {
  const editing = order !== null;

  const [client, setClient] = useState<Client | null>(order ? order.client : initialClient);
  const [form, setForm] = useState<OrderFormState>(() =>
    order ? orderToForm(order) : emptyOrderForm(),
  );
  const [errors, setErrors] = useState<OrderFormErrors>({});

  const clientsQuery = useClients();
  const productsQuery = useProducts();
  const subscriptionsQuery = useSubscriptions(false);

  const createOrders = useCreateOrders();
  const createRecurring = useCreateRecurringPlan();
  const updateOrder = useUpdateOrder();

  const patch = (changes: Partial<OrderFormState>) =>
    setForm((current) => ({ ...current, ...changes }));

  // ── Ridicari: what this client still has on site ────────────────────────
  const needsPackets = form.orderType === 'Ridicari' && !editing && client !== null;
  const clientOrdersQuery = useClientOrders(needsPackets && client ? client.id : null);
  const pickupOrderIds = useMemo(
    () => (clientOrdersQuery.data ?? []).filter(isRidicare).map((entry) => entry.id),
    [clientOrdersQuery.data],
  );
  const pickupStatusesQuery = useOrderTaskStatuses(needsPackets ? pickupOrderIds : []);
  const packetGroups = useMemo<PacketGroup[]>(() => {
    if (!needsPackets || !clientOrdersQuery.data) return [];
    const completed = new Set(
      Object.entries(pickupStatusesQuery.data ?? {})
        .filter(([, status]) => status === 'COMPLETED')
        .map(([id]) => Number(id)),
    );
    return buildPacketGroups(clientOrdersQuery.data, completed);
  }, [needsPackets, clientOrdersQuery.data, pickupStatusesQuery.data]);

  const products = productsQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];
  // Fall back to the order's own product/subscription so an edit still works
  // while the catalogue is loading, or when the record points at a retired one.
  const orderProduct = order && order.orderType === 'Amplasari' ? order.product : null;
  const selectedProduct =
    products.find((entry) => entry.id === form.productId) ??
    (orderProduct && orderProduct.id === form.productId ? orderProduct : null);
  const orderSubscription = order && order.orderType === 'Igienizari' ? order.subscription : null;
  const selectedSubscription =
    subscriptions.find((entry) => entry.id === form.subscriptionId) ??
    (orderSubscription && orderSubscription.id === form.subscriptionId
      ? orderSubscription
      : null);

  const saving = createOrders.isPending || createRecurring.isPending || updateOrder.isPending;

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!client) {
      setErrors({ client: 'Selectați un client.' });
      return;
    }
    const found = validateOrderForm(form, { mode: editing ? 'edit' : 'create' });

    if (form.orderType === 'Amplasari' && !selectedProduct) {
      found.productId = found.productId ?? 'Selectați un pachet.';
    }
    if (form.orderType === 'Igienizari' && !selectedSubscription) {
      found.subscriptionId = found.subscriptionId ?? 'Selectați abonamentul.';
    }
    setErrors(found);
    if (hasErrors(found)) {
      toast.error('Verificați câmpurile marcate.');
      return;
    }

    try {
      if (editing && order) {
        const payload =
          form.orderType === 'Amplasari' && selectedProduct
            ? buildAmplasarePayload(form, selectedProduct)
            : form.orderType === 'Igienizari' && selectedSubscription
              ? buildIgienizarePayload(form, selectedSubscription)
              : buildRidicareUpdatePayload(form);
        await updateOrder.mutateAsync({ orderId: order.id, payload });
        toast.success('Comanda a fost actualizată.');
        onClose();
        return;
      }

      if (form.orderType === 'Amplasari' && selectedProduct) {
        await createOrders.mutateAsync({
          clientId: client.id,
          payloads: [buildAmplasarePayload(form, selectedProduct)],
        });
        toast.success('Comanda de amplasare a fost salvată.');
      } else if (form.orderType === 'Ridicari') {
        const payloads = buildRidicarePayloads(form, packetGroups);
        await createOrders.mutateAsync({ clientId: client.id, payloads });
        toast.success(
          payloads.length > 1
            ? `${payloads.length} comenzi de ridicare au fost salvate.`
            : 'Comanda de ridicare a fost salvată.',
        );
      } else if (form.orderType === 'Igienizari' && selectedSubscription) {
        if (form.isRecurring) {
          await createRecurring.mutateAsync({
            clientId: client.id,
            input: buildRecurringPlanInput(form, selectedSubscription),
          });
          toast.success('Igienizarea recurentă a fost creată.');
        } else {
          await createOrders.mutateAsync({
            clientId: client.id,
            payloads: [buildIgienizarePayload(form, selectedSubscription)],
          });
          toast.success('Comanda de igienizare a fost salvată.');
        }
      }
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'Nu s-a putut salva comanda'));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Drawer
      open
      onClose={onClose}
      width="xl"
      title={
        editing && order
          ? `Editare comandă #${order.number} — ${ORDER_TYPE_LABELS[order.orderType]}`
          : 'Comandă nouă'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Anulează
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSubmit()}>
            {editing ? 'Salvează modificările' : 'Creează comanda'}
          </Button>
        </>
      }
    >
      <FormSection title="Client">
        {editing && client ? (
          <p className="text-sm text-ink">
            {clientName(client)}{' '}
            <span className="text-xs text-ink-subtle">
              {client.type === 'company' ? 'PJ' : 'PF'}
            </span>
          </p>
        ) : (
          <ClientPicker
            clients={clientsQuery.data ?? []}
            loading={clientsQuery.isLoading}
            selected={client}
            onSelect={(next) => {
              setClient(next);
              patch({ pickupSelection: {} });
            }}
            error={errors.client}
          />
        )}
      </FormSection>

      <FormSection title="Tip comandă">
        {editing ? (
          <p className="text-sm text-ink">{ORDER_TYPE_LABELS[form.orderType]}</p>
        ) : (
          <div className="inline-flex rounded-md border border-border p-0.5">
            {ORDER_TYPES.map((type: OrderTypeTag) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setErrors({});
                  setForm({
                    ...emptyOrderForm(type),
                    contactCode: form.contactCode,
                    contactDigits: form.contactDigits,
                    details: form.details,
                  });
                }}
                className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                  form.orderType === type
                    ? 'bg-brand-700 text-white'
                    : 'text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                {ORDER_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        )}
      </FormSection>

      {form.orderType === 'Amplasari' && (
        <AmplasareFields
          form={form}
          errors={errors}
          patch={patch}
          productOptions={products.map((product) => ({
            value: String(product.id),
            label: product.name,
          }))}
          productsLoading={productsQuery.isLoading}
          totalPrice={
            selectedProduct
              ? selectedProduct.price * (Number.parseInt(form.quantity, 10) || 0)
              : null
          }
        />
      )}

      {form.orderType === 'Ridicari' && (
        <RidicareFields
          form={form}
          errors={errors}
          patch={patch}
          editing={editing}
          clientChosen={client !== null}
          groups={packetGroups}
          loadingGroups={clientOrdersQuery.isLoading || pickupStatusesQuery.isLoading}
          groupsError={clientOrdersQuery.isError}
        />
      )}

      {form.orderType === 'Igienizari' && (
        <IgienizareFields
          form={form}
          errors={errors}
          patch={patch}
          editing={editing}
          subscriptionOptions={subscriptions.map((subscription) => ({
            value: String(subscription.id),
            label: subscriptionLabel(subscription),
          }))}
          subscriptionsLoading={subscriptionsQuery.isLoading}
        />
      )}

      <FormSection title="Contact & detalii">
        <FormGrid>
          <Col span={6}>
            <PhoneField
              label="Contact șantier"
              required
              code={form.contactCode}
              digits={form.contactDigits}
              error={errors.contact}
              onCodeChange={(contactCode) => patch({ contactCode })}
              onDigitsChange={(contactDigits) => patch({ contactDigits })}
            />
          </Col>
          <Col span={12}>
            <TextArea
              label="Detalii suplimentare"
              value={form.details}
              placeholder="Alte informații…"
              onChange={(event) => patch({ details: event.target.value })}
            />
          </Col>
        </FormGrid>
      </FormSection>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Amplasari
// ---------------------------------------------------------------------------

interface FieldsProps {
  form: OrderFormState;
  errors: OrderFormErrors;
  patch: (changes: Partial<OrderFormState>) => void;
}

function AmplasareFields({
  form,
  errors,
  patch,
  productOptions,
  productsLoading,
  totalPrice,
}: FieldsProps & {
  productOptions: SelectOption<string>[];
  productsLoading: boolean;
  totalPrice: number | null;
}) {
  return (
    <>
      <FormSection title="Produs">
        <FormGrid>
          <Col span={8}>
            <Select
              label="Pachet servicii"
              required
              value={form.productId === null ? null : String(form.productId)}
              options={productOptions}
              error={errors.productId}
              placeholder={productsLoading ? 'Se încarcă…' : 'Selectează pachet…'}
              onChange={(value) => patch({ productId: Number(value) })}
            />
          </Col>
          <Col span={4}>
            <Select
              label="Cantitate"
              required
              value={form.quantity}
              options={QUANTITY_OPTIONS}
              error={errors.quantity}
              onChange={(quantity) => patch({ quantity })}
            />
          </Col>
          {totalPrice !== null && (
            <Col span={12}>
              <p className="text-sm text-green-700">
                Preț total: <span className="font-semibold">{formatMoney(totalPrice)}</span>
              </p>
            </Col>
          )}
        </FormGrid>
      </FormSection>

      <FormSection title="Locație">
        <LocationFields
          label="Adresă amplasare"
          required
          value={form.placementLocation}
          addressError={errors.placementAddress}
          coordinatesError={errors.placementCoordinates}
          onChange={(placementLocation) => patch({ placementLocation })}
        />
      </FormSection>

      <FormSection title="Perioadă">
        <FormGrid>
          <Col span={4}>
            <DateInput
              label="Dată început"
              required
              value={form.startDate}
              error={errors.startDate}
              onChange={(startDate) => patch({ startDate })}
            />
          </Col>
          <Col span={4}>
            <DateInput
              label="Dată sfârșit"
              value={form.endDate}
              error={errors.endDate}
              min={form.startDate ?? undefined}
              disabled={form.isIndefinite}
              onChange={(endDate) => patch({ endDate })}
            />
          </Col>
          <Col span={4}>
            <ToggleField
              label="Nedeterminat"
              checked={form.isIndefinite}
              onChange={(isIndefinite) =>
                patch({
                  isIndefinite,
                  durationDays: isIndefinite ? '' : form.durationDays,
                  endDate: isIndefinite ? null : form.endDate,
                })
              }
            />
          </Col>
          <Col span={4}>
            <TextInput
              label="Durata contract (zile)"
              inputMode="numeric"
              required={!form.isIndefinite}
              disabled={form.isIndefinite}
              value={form.isIndefinite ? '' : form.durationDays}
              error={errors.durationDays}
              placeholder="Nr. zile"
              onChange={(event) =>
                patch({ durationDays: event.target.value.replace(/\D/g, '') })
              }
            />
          </Col>
          <Col span={4}>
            <Select
              label="Igienizări pe lună"
              required
              value={form.igienizariPerMonth}
              options={IGIENIZARI_OPTIONS}
              error={errors.igienizariPerMonth}
              onChange={(igienizariPerMonth) => patch({ igienizariPerMonth })}
            />
          </Col>
        </FormGrid>
      </FormSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// Ridicari
// ---------------------------------------------------------------------------

function RidicareFields({
  form,
  errors,
  patch,
  editing,
  clientChosen,
  groups,
  loadingGroups,
  groupsError,
}: FieldsProps & {
  editing: boolean;
  clientChosen: boolean;
  groups: PacketGroup[];
  loadingGroups: boolean;
  groupsError: boolean;
}) {
  const step = (group: PacketGroup, delta: number) => {
    const current = form.pickupSelection[group.key] ?? 0;
    const next = Math.min(group.availableCount, Math.max(0, current + delta));
    const selection = { ...form.pickupSelection };
    if (next === 0) delete selection[group.key];
    else selection[group.key] = next;
    patch({ pickupSelection: selection });
  };

  return (
    <>
      {!editing && (
        <FormSection
          title="Pachete de ridicat"
          description="Calculat din amplasările clientului, minus ce a fost deja ridicat."
        >
          {!clientChosen ? (
            <p className="text-sm text-ink-muted">Selectați întâi un client.</p>
          ) : loadingGroups ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : groupsError ? (
            <p className="text-sm text-red-600">Nu s-au putut încărca amplasările clientului.</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-ink-muted italic">
              Acest client nu are pachete active la locații cunoscute.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              {groups.map((group) => {
                const chosen = form.pickupSelection[group.key] ?? 0;
                const remaining = group.availableCount - chosen;
                return (
                  <div
                    key={group.key}
                    className={`flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 last:border-b-0 ${
                      chosen > 0 ? 'bg-red-50' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{group.productName}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {group.address ?? group.locationCoordinates ?? 'Locație necunoscută'}
                      </p>
                      <p className="text-xs text-ink-muted">
                        Disponibil:{' '}
                        <span
                          className={
                            remaining > 0 ? 'font-semibold text-green-700' : 'font-semibold text-red-600'
                          }
                        >
                          {remaining}
                        </span>{' '}
                        / {group.availableCount}
                        {group.pendingPickupCount > 0 && (
                          <span className="text-red-600">
                            {` (-${group.pendingPickupCount} urmează să fie ridicate)`}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" disabled={chosen === 0} onClick={() => step(group, -1)}>
                        −
                      </Button>
                      <span className="w-8 text-center text-sm tabular">
                        {chosen > 0 ? `-${chosen}` : '0'}
                      </span>
                      <Button
                        size="sm"
                        disabled={chosen >= group.availableCount}
                        onClick={() => step(group, 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {errors.pickupSelection && (
            <p className="mt-1.5 text-xs text-red-600">{errors.pickupSelection}</p>
          )}
        </FormSection>
      )}

      {editing && (
        <FormSection title="Ridicare">
          <FormGrid>
            <Col span={4}>
              <TextInput
                label="Cantitate"
                required
                inputMode="numeric"
                value={form.pickupQuantity}
                error={errors.pickupQuantity}
                onChange={(event) =>
                  patch({ pickupQuantity: event.target.value.replace(/\D/g, '') })
                }
              />
            </Col>
            <Col span={12}>
              <LocationFields
                label="Adresă ridicare"
                value={form.pickupLocation}
                onChange={(pickupLocation) => patch({ pickupLocation })}
              />
            </Col>
          </FormGrid>
        </FormSection>
      )}

      <FormSection title="Programare">
        <FormGrid>
          <Col span={4}>
            <DateInput
              label="Dată ridicare"
              required
              value={form.pickupDate}
              error={errors.pickupDate}
              onChange={(pickupDate) => patch({ pickupDate })}
            />
          </Col>
        </FormGrid>
      </FormSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// Igienizari
// ---------------------------------------------------------------------------

function IgienizareFields({
  form,
  errors,
  patch,
  editing,
  subscriptionOptions,
  subscriptionsLoading,
}: FieldsProps & {
  editing: boolean;
  subscriptionOptions: SelectOption<string>[];
  subscriptionsLoading: boolean;
}) {
  return (
    <>
      <FormSection title="Abonament">
        <FormGrid>
          <Col span={12}>
            <Select
              label="Abonament igienizări"
              required
              value={form.subscriptionId === null ? null : String(form.subscriptionId)}
              options={subscriptionOptions}
              error={errors.subscriptionId}
              placeholder={subscriptionsLoading ? 'Se încarcă…' : 'Selectează abonament…'}
              onChange={(value) => patch({ subscriptionId: Number(value) })}
            />
          </Col>
        </FormGrid>
      </FormSection>

      <FormSection title="Locație">
        <LocationFields
          label="Adresă igienizare"
          required
          value={form.sanitationLocation}
          addressError={errors.sanitationAddress}
          coordinatesError={errors.sanitationCoordinates}
          onChange={(sanitationLocation) => patch({ sanitationLocation })}
        />
      </FormSection>

      <FormSection title="Programare">
        <FormGrid>
          <Col span={4}>
            <DateInput
              label={form.isRecurring ? 'Dată începere' : 'Dată igienizare'}
              required
              value={form.sanitationDate}
              error={errors.sanitationDate}
              onChange={(sanitationDate) => patch({ sanitationDate })}
            />
          </Col>

          {/* Recurring plans are created, never edited, here — same as mobile. */}
          {!editing && (
            <>
              <Col span={4}>
                <ToggleField
                  label="Igienizare recurentă"
                  checked={form.isRecurring}
                  onChange={(isRecurring) => patch({ isRecurring })}
                />
              </Col>
              {form.isRecurring && (
                <>
                  <Col span={4}>
                    <Select
                      label="Frecvență"
                      value={form.frequencyDays}
                      options={FREQUENCY_SELECT}
                      onChange={(frequencyDays) => patch({ frequencyDays })}
                    />
                  </Col>
                  <Col span={4}>
                    <DateInput
                      label="Dată sfârșit recurență"
                      value={form.recurrenceEndDate}
                      error={errors.recurrenceEndDate}
                      min={form.sanitationDate ?? undefined}
                      disabled={form.recurrenceIndefinite}
                      onChange={(recurrenceEndDate) => patch({ recurrenceEndDate })}
                    />
                  </Col>
                  <Col span={4}>
                    <ToggleField
                      label="Nedeterminat"
                      checked={form.recurrenceIndefinite}
                      onChange={(recurrenceIndefinite) =>
                        patch({
                          recurrenceIndefinite,
                          recurrenceEndDate: recurrenceIndefinite ? null : form.recurrenceEndDate,
                        })
                      }
                    />
                  </Col>
                </>
              )}
            </>
          )}
        </FormGrid>
      </FormSection>
    </>
  );
}
