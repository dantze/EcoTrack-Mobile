/**
 * Order shaping: narrowing helpers, table-facing summaries, the create/edit
 * form state, its validation and the API payload builders.
 *
 * The validation rules are a port of `OrderDetails.validateOrder` in the mobile
 * app; payload construction mirrors `OrderDetails` (create) and `EditOrder`
 * (update). Everything that reads an `Order` narrows on `orderType` — the
 * discriminated union is never widened or cast.
 */

import type { OrderInput } from '@/api';
import {
  type AmplasareOrder,
  type IgienizareOrder,
  type Order,
  type OrderTypeTag,
  type Product,
  type RecurringIgienizare,
  type RidicareOrder,
  type Subscription,
  formatCoordinates,
  parseCoordinates,
} from '@/types/domain';
import { formatDate } from '@/components/domain';
import { DEFAULT_PHONE_CODE, joinPhone, splitPhone } from './validation';

// ---------------------------------------------------------------------------
// Narrowing helpers
// ---------------------------------------------------------------------------

export function isAmplasare(order: Order): order is AmplasareOrder {
  return order.orderType === 'Amplasari';
}

export function isRidicare(order: Order): order is RidicareOrder {
  return order.orderType === 'Ridicari';
}

export function isIgienizare(order: Order): order is IgienizareOrder {
  return order.orderType === 'Igienizari';
}

/** The date the order is *about* — used for sorting, filtering and display. */
export function orderPrimaryDate(order: Order): string | null {
  switch (order.orderType) {
    case 'Amplasari':
      return order.startDate;
    case 'Ridicari':
      return order.pickupDate;
    case 'Igienizari':
      return order.sanitationDate;
  }
}

/** "12 mar. 2026" or "12 mar. 2026 – 30 apr. 2026" for a placement window. */
export function orderDateLabel(order: Order): string {
  const start = orderPrimaryDate(order);
  if (!start) return '—';
  if (isAmplasare(order) && order.endDate && order.endDate !== start) {
    return `${formatDate(start)} – ${formatDate(order.endDate)}`;
  }
  if (isAmplasare(order) && order.isIndefinite) {
    return `${formatDate(start)} – nedeterminat`;
  }
  return formatDate(start);
}

export function orderAddress(order: Order): string | null {
  switch (order.orderType) {
    case 'Amplasari':
      return order.locationAddress;
    case 'Ridicari':
      return order.pickupLocationAddress;
    case 'Igienizari':
      return order.sanitationLocationAddress;
  }
}

export function orderCoordinates(order: Order): string | null {
  switch (order.orderType) {
    case 'Amplasari':
      return order.locationCoordinates;
    case 'Ridicari':
      return order.pickupLocationCoordinates;
    case 'Igienizari':
      return order.sanitationLocationCoordinates;
  }
}

/** One-line "what was ordered": product ×qty, pickup count, or subscription. */
export function orderSummary(order: Order): string {
  switch (order.orderType) {
    case 'Amplasari': {
      const name = order.product?.name ?? 'Produs';
      return order.quantity && order.quantity > 1 ? `${name} ×${order.quantity}` : name;
    }
    case 'Ridicari': {
      const name = order.pickupProductName ?? order.product?.name ?? 'Ridicare';
      return order.pickupQuantity ? `${name} ×${order.pickupQuantity}` : name;
    }
    case 'Igienizari': {
      const name = order.subscription?.name ?? 'Igienizare';
      return order.recurringPlan ? `${name} (recurent)` : name;
    }
  }
}

// ---------------------------------------------------------------------------
// Ridicari — available packet groups
// ---------------------------------------------------------------------------

/**
 * A product placed at one location for a client, with how many cabins are
 * still there. Rebuilt from the client's own orders exactly like the mobile
 * `OrderForm` does: sum the Amplasari quantities per (product, location) and
 * subtract the quantities already covered by Ridicari orders.
 */
export interface PacketGroup {
  key: string;
  productId: number | null;
  productName: string;
  locationKey: string;
  locationCoordinates: string | null;
  address: string | null;
  totalCount: number;
  alreadyPickedUp: number;
  /** Booked for pickup but the task is not COMPLETED yet — display only. */
  pendingPickupCount: number;
  availableCount: number;
}

function placementLocationKey(order: AmplasareOrder): string | null {
  return order.locationCoordinates ?? order.locationAddress ?? null;
}

function pickupLocationKey(order: RidicareOrder): string | null {
  return order.pickupLocationCoordinates ?? order.pickupLocationAddress ?? null;
}

/**
 * @param orders           every order of the client
 * @param completedPickups ids of Ridicari orders whose task is COMPLETED
 * @param excludeOrderId   the Ridicare order being edited, so it does not
 *                         consume its own availability
 */
export function buildPacketGroups(
  orders: Order[],
  completedPickups: ReadonlySet<number>,
  excludeOrderId?: number,
): PacketGroup[] {
  const groups = new Map<string, PacketGroup>();

  for (const order of orders) {
    if (!isAmplasare(order)) continue;
    const locationKey = placementLocationKey(order);
    if (!locationKey) continue;
    const productId = order.product?.id ?? null;
    const key = `${productId ?? 'unknown'}_${locationKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.totalCount += order.quantity ?? 1;
      existing.address = existing.address ?? order.locationAddress;
      continue;
    }
    groups.set(key, {
      key,
      productId,
      productName: order.product?.name ?? 'Produs necunoscut',
      locationKey,
      locationCoordinates: order.locationCoordinates,
      address: order.locationAddress,
      totalCount: order.quantity ?? 1,
      alreadyPickedUp: 0,
      pendingPickupCount: 0,
      availableCount: 0,
    });
  }

  for (const order of orders) {
    if (!isRidicare(order)) continue;
    if (excludeOrderId !== undefined && order.id === excludeOrderId) continue;
    const locationKey = pickupLocationKey(order);
    if (!locationKey) continue;
    const match = [...groups.values()].find(
      (group) =>
        group.locationKey === locationKey &&
        (order.pickupProductName === null || group.productName === order.pickupProductName),
    );
    if (!match) continue;
    const quantity = order.pickupQuantity ?? 0;
    match.alreadyPickedUp += quantity;
    if (!completedPickups.has(order.id)) match.pendingPickupCount += quantity;
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      availableCount: Math.max(0, group.totalCount - group.alreadyPickedUp),
    }))
    .filter((group) => group.availableCount > 0);
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

/** Address text plus optional manual "lat,lng". */
export interface LocationValue {
  address: string;
  coordinates: string;
}

export const EMPTY_LOCATION: LocationValue = { address: '', coordinates: '' };

export interface OrderFormState {
  orderType: OrderTypeTag;
  contactCode: string;
  contactDigits: string;
  details: string;

  // Amplasari
  productId: number | null;
  quantity: string;
  isIndefinite: boolean;
  durationDays: string;
  startDate: string | null;
  endDate: string | null;
  placementLocation: LocationValue;
  igienizariPerMonth: string;

  // Ridicari
  pickupDate: string | null;
  /** groupKey → how many cabins to take away. Create mode only. */
  pickupSelection: Record<string, number>;
  /** Edit mode only — a saved Ridicare order is a single quantity. */
  pickupQuantity: string;
  pickupLocation: LocationValue;

  // Igienizari
  subscriptionId: number | null;
  sanitationDate: string | null;
  sanitationLocation: LocationValue;
  isRecurring: boolean;
  frequencyDays: string;
  recurrenceIndefinite: boolean;
  recurrenceEndDate: string | null;
}

export function emptyOrderForm(orderType: OrderTypeTag = 'Amplasari'): OrderFormState {
  return {
    orderType,
    contactCode: DEFAULT_PHONE_CODE,
    contactDigits: '',
    details: '',
    productId: null,
    quantity: '1',
    isIndefinite: false,
    durationDays: '',
    startDate: null,
    endDate: null,
    placementLocation: { ...EMPTY_LOCATION },
    igienizariPerMonth: '1',
    pickupDate: null,
    pickupSelection: {},
    pickupQuantity: '1',
    pickupLocation: { ...EMPTY_LOCATION },
    subscriptionId: null,
    sanitationDate: null,
    sanitationLocation: { ...EMPTY_LOCATION },
    isRecurring: false,
    frequencyDays: '30',
    recurrenceIndefinite: false,
    recurrenceEndDate: null,
  };
}

function locationFrom(address: string | null, coordinates: string | null): LocationValue {
  return { address: address ?? '', coordinates: coordinates ?? '' };
}

/** Pre-fills the form from a saved order (edit mode). */
export function orderToForm(order: Order): OrderFormState {
  const contact = splitPhone(order.contact);
  const base: OrderFormState = {
    ...emptyOrderForm(order.orderType),
    contactCode: contact.code,
    contactDigits: contact.digits,
    details: order.details ?? '',
  };

  switch (order.orderType) {
    case 'Amplasari':
      return {
        ...base,
        productId: order.product?.id ?? null,
        quantity: order.quantity?.toString() ?? '1',
        isIndefinite: order.isIndefinite ?? false,
        durationDays: order.durationDays?.toString() ?? '',
        startDate: order.startDate,
        endDate: order.endDate,
        placementLocation: locationFrom(order.locationAddress, order.locationCoordinates),
        igienizariPerMonth: order.igienizariPerMonth?.toString() ?? '1',
      };
    case 'Ridicari':
      return {
        ...base,
        pickupDate: order.pickupDate,
        pickupQuantity: order.pickupQuantity?.toString() ?? '1',
        pickupLocation: locationFrom(
          order.pickupLocationAddress,
          order.pickupLocationCoordinates,
        ),
      };
    case 'Igienizari':
      return {
        ...base,
        subscriptionId: order.subscription?.id ?? null,
        sanitationDate: order.sanitationDate,
        sanitationLocation: locationFrom(
          order.sanitationLocationAddress,
          order.sanitationLocationCoordinates,
        ),
      };
  }
}

// ---------------------------------------------------------------------------
// Validation — ported from OrderDetails.validateOrder
// ---------------------------------------------------------------------------

export type OrderFormErrors = Partial<Record<string, string>>;

function normalisedCoordinates(location: LocationValue): string | null {
  const point = parseCoordinates(location.coordinates);
  return point ? formatCoordinates(point) : null;
}

function locationErrors(
  location: LocationValue,
  addressField: string,
  coordinatesField: string,
  errors: OrderFormErrors,
): void {
  if (!location.address.trim() && !location.coordinates.trim()) {
    errors[addressField] = 'Selectați locația.';
  }
  if (location.coordinates.trim() && !parseCoordinates(location.coordinates)) {
    errors[coordinatesField] = 'Coordonate invalide. Format: 44.4268,26.1025';
  }
}

export interface ValidateOptions {
  mode: 'create' | 'edit';
}

export function validateOrderForm(
  state: OrderFormState,
  { mode }: ValidateOptions,
): OrderFormErrors {
  const errors: OrderFormErrors = {};

  switch (state.orderType) {
    case 'Amplasari': {
      if (state.productId === null) errors.productId = 'Selectați un pachet.';
      if (!state.quantity.trim() || Number.parseInt(state.quantity, 10) < 1) {
        errors.quantity = 'Selectați cantitatea.';
      }
      if (!state.isIndefinite && !state.durationDays.trim()) {
        errors.durationDays = 'Introduceți durata contractului.';
      }
      if (!state.startDate && !state.endDate) {
        errors.startDate = 'Selectați perioada de amplasare.';
      }
      if (state.startDate && state.endDate && state.endDate < state.startDate) {
        errors.endDate = 'Data de sfârșit trebuie să fie după data de începere.';
      }
      locationErrors(
        state.placementLocation,
        'placementAddress',
        'placementCoordinates',
        errors,
      );
      if (!state.contactDigits.trim()) {
        errors.contact = 'Introduceți contactul de pe șantier.';
      }
      if (!state.igienizariPerMonth.trim()) {
        errors.igienizariPerMonth = 'Selectați numărul de igienizări.';
      }
      break;
    }

    case 'Ridicari': {
      if (mode === 'create') {
        const selected = Object.values(state.pickupSelection).filter((count) => count > 0);
        if (selected.length === 0) {
          errors.pickupSelection = 'Selectați cel puțin un pachet de ridicat.';
        }
      } else if (!state.pickupQuantity.trim() || Number.parseInt(state.pickupQuantity, 10) < 1) {
        errors.pickupQuantity = 'Introduceți cantitatea de ridicat.';
      }
      if (!state.pickupDate) errors.pickupDate = 'Selectați data ridicării.';
      if (!state.contactDigits.trim()) errors.contact = 'Introduceți persoana de contact.';
      break;
    }

    case 'Igienizari': {
      if (state.subscriptionId === null) errors.subscriptionId = 'Selectați abonamentul.';
      locationErrors(
        state.sanitationLocation,
        'sanitationAddress',
        'sanitationCoordinates',
        errors,
      );
      if (!state.sanitationDate) errors.sanitationDate = 'Selectați data igienizării.';
      if (state.isRecurring && !state.recurrenceIndefinite && !state.recurrenceEndDate) {
        errors.recurrenceEndDate =
          'Selectați data de sfârșit a recurenței sau bifați Nedeterminat.';
      }
      if (
        state.isRecurring &&
        !state.recurrenceIndefinite &&
        state.recurrenceEndDate &&
        state.sanitationDate &&
        state.recurrenceEndDate <= state.sanitationDate
      ) {
        errors.recurrenceEndDate = 'Data de sfârșit trebuie să fie după data de începere.';
      }
      break;
    }
  }

  if (state.contactDigits.trim() && !/^\d{4,15}$/.test(state.contactDigits.trim())) {
    errors.contact = 'Numărul de telefon trebuie să conțină doar cifre (minim 4, maxim 15).';
  }

  return errors;
}

export function hasErrors(errors: OrderFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

function contactValue(state: OrderFormState): string | null {
  return state.contactDigits.trim() ? joinPhone(state.contactCode, state.contactDigits) : null;
}

function detailsValue(state: OrderFormState): string | null {
  return state.details.trim() || null;
}

export function buildAmplasarePayload(state: OrderFormState, product: Product): OrderInput {
  return {
    orderType: 'Amplasari',
    product: { id: product.id },
    quantity: Number.parseInt(state.quantity, 10),
    isIndefinite: state.isIndefinite,
    durationDays: state.isIndefinite ? null : Number.parseInt(state.durationDays, 10),
    startDate: state.startDate,
    endDate: state.endDate,
    locationCoordinates: normalisedCoordinates(state.placementLocation),
    locationAddress: state.placementLocation.address.trim() || null,
    contact: contactValue(state),
    igienizariPerMonth: Number.parseInt(state.igienizariPerMonth, 10),
    details: detailsValue(state),
  };
}

/**
 * One Ridicare order per selected packet group, exactly like the mobile app —
 * the backend models a pickup as a single (product, location, quantity).
 */
export function buildRidicarePayloads(
  state: OrderFormState,
  groups: PacketGroup[],
): OrderInput[] {
  return Object.entries(state.pickupSelection)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const group = groups.find((candidate) => candidate.key === key);
      return {
        orderType: 'Ridicari' as const,
        pickupDate: state.pickupDate,
        pickupQuantity: count,
        pickupProductName: group?.productName ?? null,
        pickupLocationAddress: group?.address ?? null,
        pickupLocationCoordinates: group?.locationCoordinates ?? null,
        contact: contactValue(state),
        details: detailsValue(state),
      };
    });
}

export function buildRidicareUpdatePayload(state: OrderFormState): OrderInput {
  return {
    orderType: 'Ridicari',
    pickupDate: state.pickupDate,
    pickupQuantity: Number.parseInt(state.pickupQuantity, 10),
    pickupLocationAddress: state.pickupLocation.address.trim() || null,
    pickupLocationCoordinates: normalisedCoordinates(state.pickupLocation),
    contact: contactValue(state),
    details: detailsValue(state),
  };
}

export function buildIgienizarePayload(
  state: OrderFormState,
  subscription: Subscription,
): OrderInput {
  return {
    orderType: 'Igienizari',
    subscription: { id: subscription.id },
    sanitationDate: state.sanitationDate,
    sanitationLocationCoordinates: normalisedCoordinates(state.sanitationLocation),
    sanitationLocationAddress: state.sanitationLocation.address.trim() || null,
    contact: contactValue(state),
    details: detailsValue(state),
  };
}

/**
 * A recurring sanitation is a *plan*, not an order — the mobile app posts it to
 * /recurring-igienizari and the backend generates the orders. `endDate` is
 * pinned to 2100-01-01 when indefinite, same as the original.
 */
export function buildRecurringPlanInput(
  state: OrderFormState,
  subscription: Subscription,
): Partial<RecurringIgienizare> {
  return {
    subscription,
    frequencyDays: Number.parseInt(state.frequencyDays, 10) || 30,
    startDate: state.sanitationDate,
    endDate: state.recurrenceIndefinite ? '2100-01-01' : state.recurrenceEndDate,
    isIndefinite: state.recurrenceIndefinite,
    sanitationLocationCoordinates: normalisedCoordinates(state.sanitationLocation),
    sanitationLocationAddress: state.sanitationLocation.address.trim() || null,
    contact: contactValue(state),
    details: detailsValue(state),
  };
}

export const FREQUENCY_OPTIONS = [
  { value: '7', label: 'Săptămânal (7 zile)' },
  { value: '14', label: 'Bisăptămânal (14 zile)' },
  { value: '21', label: 'La 3 săptămâni (21 zile)' },
  { value: '30', label: 'Lunar (30 zile)' },
];

export function subscriptionLabel(subscription: Subscription): string {
  const price = subscription.price ?? 0;
  return subscription.type === 'ONE_TIME'
    ? `${subscription.name} — ${price} RON (o singură vizită)`
    : `${subscription.name} — ${price} RON/lună · ${subscription.visitsPerMonth ?? 0}x/lună`;
}
