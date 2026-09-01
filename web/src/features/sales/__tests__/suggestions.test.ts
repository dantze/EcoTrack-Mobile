/**
 * Order suggestions.
 *
 * These heuristics are the only place in the app where the UI proposes a value
 * the operator did not type, so two things have to hold and stay holding:
 *
 *   - the proposal is *right* — the recency-weighted mode really does prefer
 *     what the client switched to over what they used to buy, and the anomaly
 *     check really is robust to a single freak order;
 *   - the proposal is *quiet* — no card when there is no history, no anomaly
 *     warning on a client with too few orders to have a "usual". A suggestion
 *     that fires on nothing trains people to ignore it.
 *
 * Dates are built relative to today because the recency weight is a function
 * of wall-clock age; hard-coded dates would silently stop weighting anything
 * a year after this file was written.
 */

import { describe, expect, it } from 'vitest';
import type { AmplasareOrder, Client, IgienizareOrder, Order, Product, Subscription } from '@/types/domain';
import {
  buildAddressSuggestions,
  buildOrderSuggestion,
  quantityAnomaly,
  suggestOrderType,
} from '../suggestions';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10);

const CLIENT: Client = {
  id: 1,
  type: 'company',
  name: 'Acme SRL',
  CUI: 'RO123',
  adminName: null,
  email: null,
  phone: null,
  address: null,
};

const STANDARD: Product = { id: 10, name: 'Toaletă standard', description: null, price: 850, isActive: true };
const VIP: Product = { id: 11, name: 'Toaletă VIP', description: null, price: 1750, isActive: true };
const PLAN: Subscription = {
  id: 20,
  name: 'Abonament Bronze',
  description: null,
  type: 'RECURRING',
  price: 260,
  visitsPerMonth: 1,
  durationMonths: 12,
  isIndefinite: false,
  isActive: true,
};

let nextId = 100;

function placement(overrides: Partial<AmplasareOrder> & { startDate: string }): AmplasareOrder {
  nextId += 1;
  return {
    id: nextId,
    number: nextId,
    date: `${overrides.startDate}T09:00:00.000Z`,
    client: CLIENT,
    contact: '+40721000000',
    details: null,
    orderType: 'Amplasari',
    product: STANDARD,
    quantity: 2,
    isIndefinite: false,
    durationDays: 30,
    endDate: null,
    locationCoordinates: '44.43,26.10',
    locationAddress: 'Str. Veche nr. 1, Otopeni',
    igienizariPerMonth: 2,
    ...overrides,
  };
}

function sanitation(overrides: Partial<IgienizareOrder> & { sanitationDate: string }): IgienizareOrder {
  nextId += 1;
  return {
    id: nextId,
    number: nextId,
    date: `${overrides.sanitationDate}T09:00:00.000Z`,
    client: CLIENT,
    contact: '+40733111222',
    details: null,
    orderType: 'Igienizari',
    subscription: PLAN,
    sanitationLocationAddress: 'Str. Nouă nr. 5, Voluntari',
    sanitationLocationCoordinates: '44.49,26.18',
    recurringPlan: null,
    ...overrides,
  };
}

describe('suggestOrderType', () => {
  it('says nothing about a client with a single order', () => {
    expect(suggestOrderType([placement({ startDate: daysAgo(10) })])).toBeNull();
  });

  it('reports the type this client uses most', () => {
    const orders: Order[] = [
      placement({ startDate: daysAgo(10) }),
      placement({ startDate: daysAgo(40) }),
      sanitation({ sanitationDate: daysAgo(20) }),
    ];
    const hint = suggestOrderType(orders)!;
    expect(hint.type).toBe('Amplasari');
    expect(hint.count).toBe(2);
    expect(hint.total).toBe(3);
  });

  it('follows a recent switch rather than the historical majority', () => {
    // Three old sanitations, two recent placements: recency wins.
    const orders: Order[] = [
      sanitation({ sanitationDate: daysAgo(400) }),
      sanitation({ sanitationDate: daysAgo(380) }),
      sanitation({ sanitationDate: daysAgo(360) }),
      placement({ startDate: daysAgo(5) }),
      placement({ startDate: daysAgo(2) }),
    ];
    expect(suggestOrderType(orders)!.type).toBe('Amplasari');
  });
});

describe('buildOrderSuggestion', () => {
  it('returns null when the client has no order of that type', () => {
    const orders: Order[] = [sanitation({ sanitationDate: daysAgo(5) })];
    expect(buildOrderSuggestion(orders, 'Amplasari', [STANDARD], [PLAN])).toBeNull();
  });

  it('suggests the recently adopted product, not the historical one', () => {
    const orders: Order[] = [
      placement({ startDate: daysAgo(500), product: STANDARD }),
      placement({ startDate: daysAgo(480), product: STANDARD }),
      placement({ startDate: daysAgo(460), product: STANDARD }),
      placement({ startDate: daysAgo(10), product: VIP }),
      placement({ startDate: daysAgo(3), product: VIP }),
    ];
    const suggestion = buildOrderSuggestion(orders, 'Amplasari', [STANDARD, VIP], [PLAN])!;
    expect(suggestion.patch.productId).toBe(VIP.id);
  });

  it('never suggests a product that is no longer in the catalogue', () => {
    const orders: Order[] = [placement({ startDate: daysAgo(5), product: VIP })];
    const suggestion = buildOrderSuggestion(orders, 'Amplasari', [STANDARD], [PLAN])!;
    expect(suggestion.patch.productId).toBeUndefined();
  });

  it('uses the median quantity, so one freak order does not set the default', () => {
    const orders: Order[] = [
      placement({ startDate: daysAgo(30), quantity: 2 }),
      placement({ startDate: daysAgo(20), quantity: 2 }),
      placement({ startDate: daysAgo(10), quantity: 3 }),
      placement({ startDate: daysAgo(5), quantity: 40 }),
    ];
    expect(buildOrderSuggestion(orders, 'Amplasari', [STANDARD], [PLAN])!.patch.quantity).toBe('3');
  });

  it('takes the most recent address, not the most frequent one', () => {
    const orders: Order[] = [
      placement({ startDate: daysAgo(60), locationAddress: 'Șantier vechi, Otopeni' }),
      placement({ startDate: daysAgo(50), locationAddress: 'Șantier vechi, Otopeni' }),
      placement({
        startDate: daysAgo(2),
        locationAddress: 'Șantier nou, Buftea',
        locationCoordinates: '44.56,25.94',
      }),
    ];
    const suggestion = buildOrderSuggestion(orders, 'Amplasari', [STANDARD], [PLAN])!;
    expect(suggestion.patch.placementLocation).toEqual({
      address: 'Șantier nou, Buftea',
      coordinates: '44.56,25.94',
    });
  });

  it('splits the contact phone back into prefix and digits', () => {
    const orders: Order[] = [placement({ startDate: daysAgo(5), contact: '+40721000000' })];
    const suggestion = buildOrderSuggestion(orders, 'Amplasari', [STANDARD], [PLAN])!;
    expect(suggestion.patch.contactCode).toBe('+40');
    expect(suggestion.patch.contactDigits).toBe('721000000');
  });

  it('suggests the subscription for a sanitation order', () => {
    const orders: Order[] = [sanitation({ sanitationDate: daysAgo(15) })];
    const suggestion = buildOrderSuggestion(orders, 'Igienizari', [STANDARD], [PLAN])!;
    expect(suggestion.patch.subscriptionId).toBe(PLAN.id);
    expect(suggestion.patch.sanitationLocation?.address).toBe('Str. Nouă nr. 5, Voluntari');
  });

  it('lists every field it would change, in Romanian, before it changes it', () => {
    const suggestion = buildOrderSuggestion(
      [placement({ startDate: daysAgo(5) })],
      'Amplasari',
      [STANDARD],
      [PLAN],
    )!;
    expect(suggestion.details.length).toBeGreaterThan(0);
    expect(suggestion.basis).toMatch(/comand/i);
  });
});

describe('quantityAnomaly', () => {
  const history = (quantities: number[]): Order[] =>
    quantities.map((quantity, index) =>
      placement({ startDate: daysAgo(30 + index), quantity, product: STANDARD }),
    );

  it('stays quiet below three comparable orders — no "usual" to deviate from', () => {
    expect(quantityAnomaly(history([2, 2]), STANDARD.id, 40)).toBeNull();
  });

  it('flags an order-of-magnitude typo', () => {
    const anomaly = quantityAnomaly(history([2, 2, 3, 2]), STANDARD.id, 20)!;
    expect(anomaly.typical).toBe(2);
    expect(anomaly.max).toBe(3);
    expect(anomaly.message).toMatch(/neobișnuit de mare/);
  });

  it('flags an unusually small order too', () => {
    expect(quantityAnomaly(history([20, 22, 18, 20]), STANDARD.id, 1)!.message).toMatch(
      /neobișnuit de mică/,
    );
  });

  it('does not nag about ordinary variation', () => {
    expect(quantityAnomaly(history([2, 3, 2, 3]), STANDARD.id, 3)).toBeNull();
    expect(quantityAnomaly(history([10, 12, 11, 10]), STANDARD.id, 14)).toBeNull();
  });

  it('is not dragged around by a single past outlier', () => {
    // A mean would sit near 12 and hide a repeat of the same typo; the median
    // stays at 2 and still flags it.
    expect(quantityAnomaly(history([2, 2, 2, 50]), STANDARD.id, 45)).not.toBeNull();
  });

  it('ignores a quantity that is not a usable number', () => {
    expect(quantityAnomaly(history([2, 2, 2]), STANDARD.id, 0)).toBeNull();
    expect(quantityAnomaly(history([2, 2, 2]), STANDARD.id, Number.NaN)).toBeNull();
  });
});

describe('buildAddressSuggestions', () => {
  const clientOrders: Order[] = [
    placement({ startDate: daysAgo(30), locationAddress: 'Str. A nr. 1, Otopeni' }),
    placement({ startDate: daysAgo(10), locationAddress: 'Str. A nr. 1, Otopeni' }),
    placement({ startDate: daysAgo(5), locationAddress: 'Str. B nr. 2, Buftea' }),
  ];

  it("puts the client's own sites first, most used first", () => {
    const suggestions = buildAddressSuggestions(clientOrders, [], CLIENT.id);
    expect(suggestions[0]!.address).toBe('Str. A nr. 1, Otopeni');
    expect(suggestions[0]!.count).toBe(2);
    expect(suggestions.every((entry) => entry.scope === 'client')).toBe(true);
  });

  it('carries the coordinates along so accepting an address fills the point', () => {
    expect(buildAddressSuggestions(clientOrders, [], CLIENT.id)[0]!.coordinates).toBe('44.43,26.10');
  });

  it('adds other clients’ addresses after, without duplicating the client’s own', () => {
    const otherClient: Client = { ...CLIENT, id: 2 };
    const foreign = [
      placement({
        startDate: daysAgo(3),
        client: otherClient,
        locationAddress: 'str. a NR. 1, otopeni', // same place, different case
      }),
      placement({
        startDate: daysAgo(2),
        client: otherClient,
        locationAddress: 'Str. Ștefan nr. 9, Chitila',
      }),
    ];
    const suggestions = buildAddressSuggestions(clientOrders, [...clientOrders, ...foreign], CLIENT.id);
    const others = suggestions.filter((entry) => entry.scope === 'other');
    expect(others.map((entry) => entry.address)).toEqual(['Str. Ștefan nr. 9, Chitila']);
  });
});
