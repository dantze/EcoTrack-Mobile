/**
 * Order suggestions — deterministic heuristics over the client's own history.
 *
 * There is no model and no service behind any of this: everything below is
 * arithmetic on the orders already in the TanStack Query cache. It is
 * presented as a *suggestion* the operator applies or ignores; nothing here
 * ever writes to a form or to the server on its own.
 *
 * The three ideas, all reused:
 *
 *   weighted mode  — the value a client picks most often, with an exponential
 *                    recency weight (90-day half-life). A site that switched
 *                    from standard to VIP cabins three months ago suggests VIP,
 *                    not the two-year run of standard before it.
 *   latest non-null — for things that are not really "chosen" (address,
 *                    coordinates, contact) the most recent value beats the
 *                    most common one.
 *   median + MAD   — robust spread, used to flag a quantity that does not look
 *                    like this client. Means and standard deviations would be
 *                    dragged around by exactly the outlier we are hunting.
 */

import type {
  AmplasareOrder,
  IgienizareOrder,
  Order,
  OrderTypeTag,
  Product,
  Subscription,
} from '@/types/domain';
import { ORDER_TYPE_LABELS } from '@/components/domain';
import { fold } from '@/lib/search';
import { isAmplasare, isIgienizare, isRidicare, orderPrimaryDate } from './orderModel';
import type { OrderFormState } from './orderModel';
import { splitPhone } from './validation';

const RECENCY_HALF_LIFE_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Best available date for an order, as epoch ms. Falls back to its `date`. */
function orderTime(order: Order): number {
  const iso = orderPrimaryDate(order) ?? order.date;
  const parsed = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function recencyWeight(order: Order, now: number): number {
  const age = Math.max(0, now - orderTime(order));
  return Math.pow(0.5, age / (RECENCY_HALF_LIFE_DAYS * MS_PER_DAY));
}

/** Newest first. */
export function byRecency(orders: readonly Order[]): Order[] {
  return [...orders].sort((left, right) => orderTime(right) - orderTime(left));
}

interface ModeResult<T> {
  value: T;
  /** How many orders carried this value. */
  count: number;
  /** How many orders carried any value at all. */
  total: number;
}

/**
 * The recency-weighted most common value. Ties break towards the value seen
 * most recently, which is what `weight` already encodes.
 */
function weightedMode<T extends string | number>(
  orders: readonly Order[],
  read: (order: Order) => T | null | undefined,
): ModeResult<T> | null {
  const now = Date.now();
  const weights = new Map<T, { weight: number; count: number }>();
  let total = 0;

  for (const order of orders) {
    const value = read(order);
    if (value === null || value === undefined) continue;
    total += 1;
    const entry = weights.get(value) ?? { weight: 0, count: 0 };
    entry.weight += recencyWeight(order, now);
    entry.count += 1;
    weights.set(value, entry);
  }

  let best: { value: T; weight: number; count: number } | null = null;
  for (const [value, entry] of weights) {
    if (!best || entry.weight > best.weight) best = { value, ...entry };
  }
  return best ? { value: best.value, count: best.count, total } : null;
}

/** First non-empty value walking from the most recent order backwards. */
function latest<T>(orders: readonly Order[], read: (order: Order) => T | null | undefined): T | null {
  for (const order of byRecency(orders)) {
    const value = read(order);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

// ---------------------------------------------------------------------------
// Which type of order is this client likely placing?
// ---------------------------------------------------------------------------

export interface TypeHint {
  type: OrderTypeTag;
  label: string;
  count: number;
  total: number;
}

/**
 * The order type this client uses most, recency-weighted. Used only as a
 * one-line nudge next to the type switch — never to preselect a type, because
 * being silently put on the wrong subtype form is worse than one extra click.
 */
export function suggestOrderType(clientOrders: readonly Order[]): TypeHint | null {
  if (clientOrders.length < 2) return null;
  const mode = weightedMode<OrderTypeTag>(clientOrders, (order) => order.orderType);
  if (!mode) return null;
  return {
    type: mode.value,
    label: ORDER_TYPE_LABELS[mode.value],
    count: mode.count,
    total: mode.total,
  };
}

// ---------------------------------------------------------------------------
// Pre-fill from history
// ---------------------------------------------------------------------------

export interface OrderSuggestion {
  /** Romanian bullets describing exactly what "Aplică" will change. */
  details: string[];
  /** How the suggestion was derived, for the card's footnote. */
  basis: string;
  /** Partial form state to merge in when the operator accepts. */
  patch: Partial<OrderFormState>;
}

function locationPatch(
  address: string | null,
  coordinates: string | null,
  field: 'placementLocation' | 'sanitationLocation',
): Partial<OrderFormState> {
  if (!address && !coordinates) return {};
  return { [field]: { address: address ?? '', coordinates: coordinates ?? '' } };
}

/**
 * Builds the "same as last time" suggestion for the type currently selected.
 * Returns null when the client has no usable history for that type — an empty
 * card is worse than no card.
 *
 * @param clientOrders  every order of the selected client (`/clients/{id}/orders`)
 * @param orderType     the subtype form currently on screen
 * @param products      the live catalogue, so a retired product is not suggested
 * @param subscriptions likewise for sanitation plans
 */
export function buildOrderSuggestion(
  clientOrders: readonly Order[],
  orderType: OrderTypeTag,
  products: readonly Product[],
  subscriptions: readonly Subscription[],
): OrderSuggestion | null {
  const sameType = clientOrders.filter((order) => order.orderType === orderType);
  if (sameType.length === 0) return null;

  const details: string[] = [];
  let patch: Partial<OrderFormState> = {};

  // Contact is shared by all three subtypes and is nearly always the same
  // person for the same client, so it is worth suggesting on its own.
  const contact = latest(sameType, (order) => order.contact);
  if (contact) {
    const parts = splitPhone(contact);
    if (parts.digits) {
      patch = { ...patch, contactCode: parts.code, contactDigits: parts.digits };
      details.push(`Contact șantier ${parts.code} ${parts.digits}`);
    }
  }

  if (orderType === 'Amplasari') {
    const placements = sameType.filter(isAmplasare);

    const productMode = weightedMode<number>(placements, (order) =>
      isAmplasare(order) ? (order.product?.id ?? null) : null,
    );
    const product =
      productMode && products.find((entry) => entry.id === productMode.value)
        ? products.find((entry) => entry.id === productMode.value)!
        : null;
    if (product && productMode) {
      patch = { ...patch, productId: product.id };
      details.push(
        `Pachet „${product.name}” (${productMode.count} din ${productMode.total} amplasări)`,
      );
    }

    const quantities = placements
      .filter((order) => (product ? order.product?.id === product.id : true))
      .map((order) => order.quantity)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    const typicalQuantity = median(quantities);
    if (typicalQuantity !== null) {
      const rounded = String(Math.max(1, Math.round(typicalQuantity)));
      patch = { ...patch, quantity: rounded };
      details.push(`Cantitate ${rounded} (mediana comenzilor anterioare)`);
    }

    const address = latest(placements, (order) =>
      isAmplasare(order) ? order.locationAddress : null,
    );
    const coordinates = latest(placements, (order) =>
      isAmplasare(order) ? order.locationCoordinates : null,
    );
    if (address || coordinates) {
      patch = { ...patch, ...locationPatch(address, coordinates, 'placementLocation') };
      details.push(`Adresă „${address ?? coordinates}”`);
    }

    const igienizariMode = weightedMode<number>(placements, (order) =>
      isAmplasare(order) ? order.igienizariPerMonth : null,
    );
    if (igienizariMode) {
      patch = { ...patch, igienizariPerMonth: String(igienizariMode.value) };
      details.push(`${igienizariMode.value} igienizări pe lună`);
    }

    const durationMode = weightedMode<number>(placements, (order) =>
      isAmplasare(order) && !order.isIndefinite ? order.durationDays : null,
    );
    if (durationMode) {
      patch = { ...patch, durationDays: String(durationMode.value), isIndefinite: false };
      details.push(`Durată contract ${durationMode.value} zile`);
    }
  }

  if (orderType === 'Igienizari') {
    const sanitations = sameType.filter(isIgienizare);

    const subscriptionMode = weightedMode<number>(sanitations, (order) =>
      isIgienizare(order) ? (order.subscription?.id ?? null) : null,
    );
    const subscription =
      subscriptionMode && subscriptions.find((entry) => entry.id === subscriptionMode.value);
    if (subscription) {
      patch = { ...patch, subscriptionId: subscription.id };
      details.push(
        `Abonament „${subscription.name}” (${subscriptionMode!.count} din ${subscriptionMode!.total} igienizări)`,
      );
    }

    const address = latest(sanitations, (order) =>
      isIgienizare(order) ? order.sanitationLocationAddress : null,
    );
    const coordinates = latest(sanitations, (order) =>
      isIgienizare(order) ? order.sanitationLocationCoordinates : null,
    );
    if (address || coordinates) {
      patch = { ...patch, ...locationPatch(address, coordinates, 'sanitationLocation') };
      details.push(`Adresă „${address ?? coordinates}”`);
    }
  }

  if (details.length === 0) return null;

  const newest = byRecency(sameType)[0];
  const newestDate = newest ? (orderPrimaryDate(newest) ?? newest.date) : null;

  return {
    details,
    basis:
      sameType.length === 1
        ? 'Din singura comandă anterioară de acest tip.'
        : `Din ${sameType.length} comenzi anterioare de acest tip${
            newestDate ? `, cea mai recentă din ${newestDate.slice(0, 10)}` : ''
          }.`,
    patch,
  };
}

// ---------------------------------------------------------------------------
// Quantity sanity check
// ---------------------------------------------------------------------------

export interface QuantityAnomaly {
  typical: number;
  max: number;
  samples: number;
  message: string;
}

const MIN_SAMPLES = 3;
const RATIO_THRESHOLD = 2;

/**
 * Flags a placement quantity that does not look like this client's habit.
 *
 * Robust on purpose: the median and the median absolute deviation are not
 * moved by a single freak order, which is exactly the shape of a typo (a
 * stray zero) we are trying to catch. Needs at least three comparable orders —
 * below that there is no "usual" to be unusual against, and a false alarm on a
 * new client is worse than no alarm at all.
 *
 * This is a warning, never a validation error: 30 cabins for a festival is a
 * real order and must stay one click away.
 */
export function quantityAnomaly(
  clientOrders: readonly Order[],
  productId: number | null,
  quantity: number,
): QuantityAnomaly | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const placements = clientOrders.filter(isAmplasare);
  const sameProduct = placements.filter((order) => order.product?.id === productId);
  const pool: AmplasareOrder[] = sameProduct.length >= MIN_SAMPLES ? sameProduct : placements;

  const history = pool
    .map((order) => order.quantity)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (history.length < MIN_SAMPLES) return null;

  const typical = median(history)!;
  const deviations = history.map((value) => Math.abs(value - typical));
  const mad = median(deviations) ?? 0;
  const distance = Math.abs(quantity - typical);

  // Two independent guards: far outside the observed spread, AND at least
  // double (or half) the usual — so a 3-vs-2 difference never nags.
  const outsideSpread = distance > Math.max(3 * mad, 1);
  const ratio = quantity > typical ? quantity / typical : typical / quantity;
  if (!outsideSpread || ratio < RATIO_THRESHOLD) return null;

  const max = Math.max(...history);
  return {
    typical,
    max,
    samples: history.length,
    message:
      quantity > typical
        ? `Cantitate neobișnuit de mare: acest client a comandat de regulă ${typical} bucăți (maxim ${max}, din ${history.length} comenzi). Verificați înainte de salvare.`
        : `Cantitate neobișnuit de mică: acest client a comandat de regulă ${typical} bucăți (din ${history.length} comenzi). Verificați înainte de salvare.`,
  };
}

// ---------------------------------------------------------------------------
// Address suggestions
// ---------------------------------------------------------------------------

export interface AddressSuggestion {
  address: string;
  /** "lat,lng" carried along so accepting the address also fills the point. */
  coordinates: string | null;
  /** ISO date of the most recent order at this address. */
  lastUsed: string | null;
  count: number;
  /** 'client' = this client's own sites; 'other' = anywhere in the database. */
  scope: 'client' | 'other';
}

function addressOf(order: Order): { address: string | null; coordinates: string | null } {
  if (isAmplasare(order)) {
    return { address: order.locationAddress, coordinates: order.locationCoordinates };
  }
  if (isRidicare(order)) {
    return {
      address: order.pickupLocationAddress,
      coordinates: order.pickupLocationCoordinates,
    };
  }
  const sanitation = order as IgienizareOrder;
  return {
    address: sanitation.sanitationLocationAddress,
    coordinates: sanitation.sanitationLocationCoordinates,
  };
}

/**
 * Addresses worth offering in the location field: this client's own sites
 * first (they are what the operator wants ~90% of the time), then every other
 * address in the order book, so a new site next door to a known one can be
 * copied instead of retyped.
 *
 * Deduplicated case- and diacritic-insensitively via the caller's fold; ranked
 * by how recently and how often each was used.
 */
export function buildAddressSuggestions(
  clientOrders: readonly Order[],
  allOrders: readonly Order[],
  clientId: number | null,
  limit = 40,
): AddressSuggestion[] {
  const collect = (orders: readonly Order[], scope: 'client' | 'other') => {
    const map = new Map<string, AddressSuggestion>();
    for (const order of byRecency(orders)) {
      const { address, coordinates } = addressOf(order);
      const trimmed = address?.trim();
      if (!trimmed) continue;
      const key = fold(trimmed);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.coordinates = existing.coordinates ?? coordinates;
        continue;
      }
      map.set(key, {
        address: trimmed,
        coordinates,
        lastUsed: orderPrimaryDate(order) ?? order.date,
        count: 1,
        scope,
      });
    }
    return [...map.values()];
  };

  const own = collect(clientOrders, 'client');
  const ownKeys = new Set(own.map((entry) => fold(entry.address)));
  const others = collect(
    allOrders.filter((order) => clientId === null || order.client.id !== clientId),
    'other',
  ).filter((entry) => !ownKeys.has(fold(entry.address)));

  const byUse = (left: AddressSuggestion, right: AddressSuggestion) =>
    right.count - left.count ||
    (right.lastUsed ?? '').localeCompare(left.lastUsed ?? '');

  return [...own.sort(byUse), ...others.sort(byUse)].slice(0, limit);
}
