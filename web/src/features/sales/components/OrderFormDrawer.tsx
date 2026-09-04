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
 *
 * Once a client is chosen the form also offers what `../suggestions.ts` derives
 * from that client's own order history: a pre-fill card, an address typeahead,
 * a note about the type they usually order, and a warning when a quantity is
 * far outside their norm. All of it is local arithmetic over data already
 * fetched, all of it is opt-in — nothing is written to the form until the
 * operator presses "Aplică".
 */

import { useMemo, useState } from 'react';
import {
  Button,
  DateInput,
  Drawer,
  SegmentedControl,
  Select,
  Spinner,
  SuggestionCard,
  TextArea,
  TextInput,
  WarningNote,
  snapshot,
  useUnsavedChangesGuard,
  type AutocompleteOption,
  type SelectOption,
} from '@/components/ui';
import { ORDER_TYPE_LABELS, formatMoney } from '@/components/domain';
import {
  ORDER_TYPES,
  type Client,
  type Order,
  type OrderTypeTag,
  clientName,
  parseCoordinates,
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
import { focusFirstInvalidField } from '../validation';
import {
  useClientOrders,
  useClients,
  useCreateOrders,
  useCreateRecurringPlan,
  useOrderTaskStatuses,
  useOrders,
  useProducts,
  useSubscriptions,
  useUpdateOrder,
} from '../queries';
import {
  buildAddressSuggestions,
  buildOrderSuggestion,
  quantityAnomaly,
  suggestOrderType,
} from '../suggestions';
import { ClientPicker } from './ClientPicker';
import type { KnownPlace } from './LocationPickerModal';
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
  /** Suggestion cards the operator has dismissed, keyed by `${clientId}:${type}`. */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  /**
   * Unsaved-changes guard (TODO-58). The baseline is taken once, from the same
   * props the state was seeded with, and never updated — `useState` with a lazy
   * initialiser rather than a ref because this is READ during render, which a
   * ref is not allowed to be. The client id is folded in because choosing a
   * client is real work that lives outside `form`.
   *
   * `dismissed` is deliberately absent: dismissing a suggestion card is not
   * work worth warning about losing.
   */
  const asSnapshot = () => snapshot({ clientId: client?.id ?? null, form });
  const [baseline] = useState(asSnapshot);
  const requestClose = useUnsavedChangesGuard({
    dirty: asSnapshot() !== baseline,
    onClose,
    body: 'Comanda nu a fost salvată. Modificările din formular se pierd.',
  });

  const clientsQuery = useClients();
  const productsQuery = useProducts();
  const subscriptionsQuery = useSubscriptions(false);
  // Cached by OrdersPage; only used to widen the address typeahead beyond this
  // client's own sites, so a cold cache costs nothing but a shorter list.
  const allOrdersQuery = useOrders();

  const createOrders = useCreateOrders();
  const createRecurring = useCreateRecurringPlan();
  const updateOrder = useUpdateOrder();

  const patch = (changes: Partial<OrderFormState>) =>
    setForm((current) => ({ ...current, ...changes }));

  /**
   * Changing the type resets the subtype-specific fields — they do not
   * translate — but keeps the three that are common to every type, so an
   * operator who typed a phone number and then noticed the wrong type does not
   * retype it. Both the segmented control and the "Comută pe …" hint go
   * through here; they used to hold two copies of this list, one of which
   * would eventually have been forgotten when a field was added.
   */
  const switchOrderType = (type: OrderTypeTag) => {
    setErrors({});
    setForm((current) => ({
      ...emptyOrderForm(type),
      contactCode: current.contactCode,
      contactDigits: current.contactDigits,
      details: current.details,
    }));
  };

  // ── This client's history ───────────────────────────────────────────────
  // Fetched as soon as a client is chosen, not only for Ridicari: the same
  // list feeds the packet groups, the pre-fill card and the address typeahead.
  const clientOrdersQuery = useClientOrders(client ? client.id : null);
  const clientOrders = useMemo(() => clientOrdersQuery.data ?? [], [clientOrdersQuery.data]);

  const needsPackets = form.orderType === 'Ridicari' && !editing && client !== null;
  const pickupOrderIds = useMemo(
    () => (clientOrdersQuery.data ?? []).filter(isRidicare).map((entry) => entry.id),
    [clientOrdersQuery.data],
  );
  const pickupStatusesQuery = useOrderTaskStatuses(needsPackets ? pickupOrderIds : []);
  const packetGroups = useMemo<PacketGroup[]>(() => {
    if (!needsPackets || clientOrders.length === 0) return [];
    const completed = new Set(
      Object.entries(pickupStatusesQuery.data ?? {})
        .filter(([, status]) => status === 'COMPLETED')
        .map(([id]) => Number(id)),
    );
    return buildPacketGroups(clientOrders, completed);
  }, [needsPackets, clientOrders, pickupStatusesQuery.data]);

  // Memoised because the `?? []` is a fresh array on every render whenever the
  // query has not resolved, and both feed the `suggestion` memo below — so
  // without this that memo recomputes on every render while the catalogue loads,
  // which is exactly the case it exists to avoid (TODO-26).
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const subscriptions = useMemo(() => subscriptionsQuery.data ?? [], [subscriptionsQuery.data]);
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

  // ── Local suggestions, derived from this client's own orders ────────────
  const suggestionKey = client ? `${client.id}:${form.orderType}` : '';

  const suggestion = useMemo(
    () =>
      editing || !client || clientOrders.length === 0
        ? null
        : buildOrderSuggestion(clientOrders, form.orderType, products, subscriptions),
    [editing, client, clientOrders, form.orderType, products, subscriptions],
  );

  const typeHint = useMemo(
    () => (editing || !client ? null : suggestOrderType(clientOrders)),
    [editing, client, clientOrders],
  );

  const addressSuggestions = useMemo(
    () =>
      client
        ? buildAddressSuggestions(clientOrders, allOrdersQuery.data ?? [], client.id)
        : [],
    [client, clientOrders, allOrdersQuery.data],
  );

  const addressOptions = useMemo<AutocompleteOption[]>(
    () =>
      addressSuggestions.map((entry) => ({
        value: entry.address,
        hint: [
          entry.count > 1 ? `${entry.count} comenzi` : '1 comandă',
          entry.lastUsed ? `ultima: ${entry.lastUsed.slice(0, 10)}` : null,
          entry.coordinates ? 'cu coordonate' : null,
        ]
          .filter(Boolean)
          .join(' · '),
        group:
          entry.scope === 'client' ? 'Adresele acestui client' : 'Alte adrese din sistem',
      })),
    [addressSuggestions],
  );

  const coordinatesForAddress = (option: AutocompleteOption) =>
    addressSuggestions.find((entry) => entry.address === option.value)?.coordinates ?? null;

  // The same history, for the map picker's markers. Only the entries that
  // actually carry a point can be drawn — an address with no coordinates is a
  // typeahead row and nothing more.
  const knownPlaces = useMemo<KnownPlace[]>(
    () =>
      addressSuggestions.flatMap((entry) => {
        const point = parseCoordinates(entry.coordinates);
        return point
          ? [{ address: entry.address, point, count: entry.count, scope: entry.scope }]
          : [];
      }),
    [addressSuggestions],
  );

  const quantityWarning = useMemo(() => {
    if (form.orderType !== 'Amplasari') return null;
    const parsed = Number.parseInt(form.quantity, 10);
    if (!Number.isFinite(parsed)) return null;
    return quantityAnomaly(clientOrders, form.productId, parsed);
  }, [form.orderType, form.quantity, form.productId, clientOrders]);

  const applySuggestion = () => {
    if (!suggestion) return;
    setForm((current) => ({ ...current, ...suggestion.patch }));
    setErrors({});
    toast.info('Câmpurile au fost completate din istoricul clientului.');
    setDismissed((current) => new Set(current).add(suggestionKey));
  };

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
      focusFirstInvalidField(found);
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
      onClose={requestClose}
      width="xl"
      title={
        editing && order
          ? `Editare comandă #${order.number} — ${ORDER_TYPE_LABELS[order.orderType]}`
          : 'Comandă nouă'
      }
      footer={
        <>
          <Button variant="secondary" onClick={requestClose} disabled={saving}>
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
          <SegmentedControl
            aria-label="Tip comandă"
            value={form.orderType}
            onChange={switchOrderType}
            options={ORDER_TYPES.map((type: OrderTypeTag) => ({
              value: type,
              label: ORDER_TYPE_LABELS[type],
            }))}
          />
        )}

        {typeHint && !editing && (
          <p className="mt-2 text-xs text-ink-muted">
            Acest client comandă de obicei{' '}
            <span className="font-medium text-ink">{typeHint.label}</span> ({typeHint.count} din{' '}
            {typeHint.total} comenzi).
            {typeHint.type !== form.orderType && (
              <button
                type="button"
                onClick={() => switchOrderType(typeHint.type)}
                className="ml-1.5 font-medium text-primary underline underline-offset-2 hover:text-primary"
              >
                Comută pe {typeHint.label}
              </button>
            )}
          </p>
        )}
      </FormSection>

      {suggestion && !dismissed.has(suggestionKey) && (
        <div className="pb-4">
          <SuggestionCard
            title="Completează din istoricul clientului"
            details={suggestion.details}
            basis={suggestion.basis}
            onApply={applySuggestion}
            onDismiss={() => setDismissed((current) => new Set(current).add(suggestionKey))}
          />
        </div>
      )}

      {form.orderType === 'Amplasari' && (
        <AmplasareFields
          form={form}
          errors={errors}
          patch={patch}
          addressOptions={addressOptions}
          coordinatesForAddress={coordinatesForAddress}
          knownPlaces={knownPlaces}
          quantityWarning={quantityWarning?.message ?? null}
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
          addressOptions={addressOptions}
          coordinatesForAddress={coordinatesForAddress}
          knownPlaces={knownPlaces}
        />
      )}

      {form.orderType === 'Igienizari' && (
        <IgienizareFields
          form={form}
          errors={errors}
          patch={patch}
          editing={editing}
          addressOptions={addressOptions}
          coordinatesForAddress={coordinatesForAddress}
          knownPlaces={knownPlaces}
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
              id="contact"
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
  addressOptions,
  coordinatesForAddress,
  knownPlaces,
  quantityWarning,
}: FieldsProps & {
  productOptions: SelectOption<string>[];
  productsLoading: boolean;
  totalPrice: number | null;
  addressOptions: AutocompleteOption[];
  coordinatesForAddress: (option: AutocompleteOption) => string | null;
  knownPlaces: readonly KnownPlace[];
  /** Non-blocking note when the quantity is unlike this client's usual. */
  quantityWarning: string | null;
}) {
  return (
    <>
      <FormSection title="Produs">
        <FormGrid>
          <Col span={8}>
            <Select
              id="productId"
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
              id="quantity"
              label="Cantitate"
              required
              value={form.quantity}
              options={QUANTITY_OPTIONS}
              error={errors.quantity}
              onChange={(quantity) => patch({ quantity })}
            />
          </Col>
          {quantityWarning && (
            <Col span={12}>
              <WarningNote>{quantityWarning}</WarningNote>
            </Col>
          )}
          {totalPrice !== null && (
            <Col span={12}>
              <p className="text-sm text-success-700">
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
          addressId="placementAddress"
          coordinatesId="placementCoordinates"
          suggestions={addressOptions}
          coordinatesFor={coordinatesForAddress}
          knownPlaces={knownPlaces}
          onChange={(placementLocation) => patch({ placementLocation })}
        />
      </FormSection>

      <FormSection title="Perioadă">
        <FormGrid>
          <Col span={4}>
            <DateInput
              id="startDate"
              label="Dată început"
              required
              value={form.startDate}
              error={errors.startDate}
              onChange={(startDate) => patch({ startDate })}
            />
          </Col>
          <Col span={4}>
            <DateInput
              id="endDate"
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
              id="durationDays"
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
              id="igienizariPerMonth"
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
  addressOptions,
  coordinatesForAddress,
  knownPlaces,
}: FieldsProps & {
  editing: boolean;
  clientChosen: boolean;
  groups: PacketGroup[];
  loadingGroups: boolean;
  groupsError: boolean;
  addressOptions: AutocompleteOption[];
  coordinatesForAddress: (option: AutocompleteOption) => string | null;
  knownPlaces: readonly KnownPlace[];
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
            <p className="text-sm text-danger-600">Nu s-au putut încărca amplasările clientului.</p>
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
                      chosen > 0 ? 'bg-danger-50' : ''
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
                            remaining > 0 ? 'font-semibold text-success-700' : 'font-semibold text-danger-600'
                          }
                        >
                          {remaining}
                        </span>{' '}
                        / {group.availableCount}
                        {group.pendingPickupCount > 0 && (
                          <span className="text-danger-600">
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
            <p className="mt-1.5 text-xs text-danger-600">{errors.pickupSelection}</p>
          )}
        </FormSection>
      )}

      {editing && (
        <FormSection title="Ridicare">
          <FormGrid>
            <Col span={4}>
              <TextInput
                id="pickupQuantity"
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
              {/*
                Edit mode only. The pickup address normally arrives from the
                packet group rather than being typed, which is why this field
                started out plain — but once someone IS editing it by hand they
                deserve the same typeahead the placement and sanitation
                addresses get, and accepting a suggestion carries its
                coordinates across too.
              */}
              <LocationFields
                label="Adresă ridicare"
                value={form.pickupLocation}
                suggestions={addressOptions}
                coordinatesFor={coordinatesForAddress}
                knownPlaces={knownPlaces}
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
              id="pickupDate"
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
  addressOptions,
  coordinatesForAddress,
  knownPlaces,
}: FieldsProps & {
  editing: boolean;
  subscriptionOptions: SelectOption<string>[];
  subscriptionsLoading: boolean;
  addressOptions: AutocompleteOption[];
  coordinatesForAddress: (option: AutocompleteOption) => string | null;
  knownPlaces: readonly KnownPlace[];
}) {
  return (
    <>
      <FormSection title="Abonament">
        <FormGrid>
          <Col span={12}>
            <Select
              id="subscriptionId"
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
          addressId="sanitationAddress"
          coordinatesId="sanitationCoordinates"
          suggestions={addressOptions}
          coordinatesFor={coordinatesForAddress}
          knownPlaces={knownPlaces}
          onChange={(sanitationLocation) => patch({ sanitationLocation })}
        />
      </FormSection>

      <FormSection title="Programare">
        <FormGrid>
          <Col span={4}>
            <DateInput
              id="sanitationDate"
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
                      id="recurrenceEndDate"
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
