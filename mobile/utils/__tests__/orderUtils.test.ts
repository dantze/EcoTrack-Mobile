import { describe, it, expect } from 'vitest';
import {
    getDateInfo,
    getClientName,
    getLocationText,
    getActionText,
    getOrderTypeLabel,
    formatDate,
} from '../orderUtils';
import type {
    AmplasareOrder,
    IgienizareOrder,
    OrderClient,
    RidicareOrder,
} from '../../types/OrderTypes';

/**
 * `getDateInfo` is the fiddly one: three order subtypes each keep their date
 * under a different field name, and only Amplasare can produce a range.
 *
 * TIMEZONE: these assertions depend on `vitest.config.ts` pinning
 * TZ=Europe/Bucharest. `new Date('2026-03-15')` is parsed as UTC midnight and
 * read back with the local `getDate()`, so anywhere west of UTC every bare date
 * here reports the day BEFORE. That is a real (latent) bug in the app, not just
 * a test artefact — it just happens to be invisible to users in Romania, who
 * are always east of UTC. `dateOffByOneWestOfUtc` below pins the mechanism so
 * nobody has to rediscover it.
 */

const client: OrderClient = { id: 1, fullName: 'Ana Popescu' };

const amplasare = (over: Partial<AmplasareOrder> = {}): AmplasareOrder => ({
    orderType: 'Amplasari',
    id: 1,
    contact: '0700000000',
    details: '',
    client,
    quantity: 2,
    ...over,
});

const ridicare = (over: Partial<RidicareOrder> = {}): RidicareOrder => ({
    orderType: 'Ridicari',
    id: 2,
    contact: '0700000000',
    details: '',
    client,
    ...over,
});

const igienizare = (over: Partial<IgienizareOrder> = {}): IgienizareOrder => ({
    orderType: 'Igienizari',
    id: 3,
    contact: '0700000000',
    details: '',
    client,
    ...over,
});

describe('getDateInfo', () => {
    it('reads startDate for an Amplasare', () => {
        expect(getDateInfo(amplasare({ startDate: '2026-03-15' }))).toEqual({
            isRange: false,
            m: 'MAR',
            d: 15,
        });
    });

    it('reads pickupDate for a Ridicare', () => {
        expect(getDateInfo(ridicare({ pickupDate: '2026-07-04' }))).toEqual({
            isRange: false,
            m: 'IUL',
            d: 4,
        });
    });

    it('reads sanitationDate for an Igienizare', () => {
        expect(getDateInfo(igienizare({ sanitationDate: '2026-12-31' }))).toEqual({
            isRange: false,
            m: 'DEC',
            d: 31,
        });
    });

    it('returns a range when an Amplasare spans two different days', () => {
        expect(
            getDateInfo(amplasare({ startDate: '2026-03-15', endDate: '2026-04-02' })),
        ).toEqual({
            isRange: true,
            start: { m: 'MAR', d: 15 },
            end: { m: 'APR', d: 2 },
        });
    });

    it('collapses a range whose end is the same calendar day', () => {
        // Same day, different clock time: one visit, not a range.
        const info = getDateInfo(
            amplasare({ startDate: '2026-03-15T08:00:00Z', endDate: '2026-03-15T17:00:00Z' }),
        );
        expect(info).toEqual({ isRange: false, m: 'MAR', d: 15 });
    });

    it('ignores an endDate identical to the startDate', () => {
        expect(
            getDateInfo(amplasare({ startDate: '2026-03-15', endDate: '2026-03-15' })),
        ).toEqual({ isRange: false, m: 'MAR', d: 15 });
    });

    it('ignores an endDate on a subtype that cannot have one', () => {
        // Only Amplasare reads endDate; a stray one elsewhere must not create a range.
        const info = getDateInfo(ridicare({ pickupDate: '2026-03-15' }) as RidicareOrder);
        expect(info).toEqual({ isRange: false, m: 'MAR', d: 15 });
    });

    it('falls back to N/A when the date is missing', () => {
        expect(getDateInfo(amplasare())).toEqual({ isRange: false, m: 'N/A', d: '--' });
    });

    it('falls back to N/A when the date is unparseable', () => {
        expect(getDateInfo(amplasare({ startDate: 'not-a-date' }))).toEqual({
            isRange: false,
            m: 'N/A',
            d: '--',
        });
    });

    it('falls back to N/A rather than throwing on an empty string', () => {
        expect(getDateInfo(amplasare({ startDate: '' }))).toEqual({
            isRange: false,
            m: 'N/A',
            d: '--',
        });
    });

    it('drops a malformed endDate back to a single date instead of a broken range', () => {
        expect(
            getDateInfo(amplasare({ startDate: '2026-03-15', endDate: 'garbage' })),
        ).toEqual({ isRange: false, m: 'MAR', d: 15 });
    });

    it('dateOffByOneWestOfUtc: bare YYYY-MM-DD is UTC midnight read back locally', () => {
        // Pins the mechanism behind the TZ note at the top of this file. This is
        // what would make every date in the app render one day early for a user
        // west of UTC — and why vitest.config.ts pins the zone.
        const parsed = new Date('2026-03-15');
        expect(parsed.getUTCDate()).toBe(15);
        expect(parsed.getUTCHours()).toBe(0);
        // Romania is ahead of UTC, so the local date still reads 15.
        expect(parsed.getDate()).toBe(15);
    });
});

describe('getClientName', () => {
    it('prefers fullName', () => {
        expect(getClientName(amplasare())).toBe('Ana Popescu');
    });

    it('falls back to name, then email', () => {
        expect(getClientName(amplasare({ client: { id: 1, name: 'ACME SRL' } }))).toBe('ACME SRL');
        expect(getClientName(amplasare({ client: { id: 1, email: 'a@b.ro' } }))).toBe('a@b.ro');
    });

    it('falls back to the Romanian placeholder when the client has no usable name', () => {
        expect(getClientName(amplasare({ client: { id: 1 } }))).toBe('Client necunoscut');
    });

    it('does not throw when the client is missing entirely', () => {
        expect(getClientName(amplasare({ client: undefined as unknown as OrderClient })))
            .toBe('Client necunoscut');
    });

    it('skips an empty-string fullName rather than rendering a blank row', () => {
        expect(getClientName(amplasare({ client: { id: 1, fullName: '', name: 'ACME' } })))
            .toBe('ACME');
    });
});

describe('getLocationText', () => {
    it('prefers the address of each subtype', () => {
        expect(getLocationText(amplasare({ locationAddress: 'Str. A 1' }))).toBe('Str. A 1');
        expect(getLocationText(ridicare({ pickupLocationAddress: 'Str. B 2' }))).toBe('Str. B 2');
        expect(getLocationText(igienizare({ sanitationLocationAddress: 'Str. C 3' }))).toBe('Str. C 3');
    });

    it('falls back to truncated coordinates', () => {
        expect(
            getLocationText(amplasare({ locationCoordinates: '46.7712345678,23.6236123456' })),
        ).toBe('46.771234, 23.623612');
    });

    it('passes coordinates through unchanged when they are not a lat,lng pair', () => {
        expect(getLocationText(amplasare({ locationCoordinates: 'somewhere' }))).toBe('somewhere');
    });

    it('falls back to the client address, then the Romanian placeholder', () => {
        expect(getLocationText(amplasare({ client: { id: 1, address: 'Sediu' } }))).toBe('Sediu');
        expect(getLocationText(amplasare())).toBe('Locație nespecificată');
    });
});

describe('getActionText', () => {
    it('shows the quantity for placements and pickups', () => {
        expect(getActionText(amplasare({ quantity: 5 }))).toBe('Amplasare (x5)');
        expect(getActionText(ridicare({ pickupQuantity: 3 }))).toBe('Ridicare (x3)');
    });

    it('defaults a missing quantity to 1 rather than rendering x0 or xundefined', () => {
        expect(getActionText(ridicare())).toBe('Ridicare (x1)');
        expect(getActionText(amplasare({ quantity: 0 }))).toBe('Amplasare (x1)');
    });

    it('names the subscription for an Igienizare when there is one', () => {
        expect(
            getActionText(
                igienizare({ subscription: { id: 1, name: 'Lunar', type: 'M', price: 100 } }),
            ),
        ).toBe('Igienizare · Lunar');
        expect(getActionText(igienizare())).toBe('Igienizare');
    });
});

describe('getOrderTypeLabel', () => {
    it('maps the wire discriminators to Romanian labels, case-insensitively', () => {
        expect(getOrderTypeLabel('amplasari')).toBe('Amplasare');
        expect(getOrderTypeLabel('Amplasari')).toBe('Amplasare');
        expect(getOrderTypeLabel('IGIENIZARI')).toBe('Igienizare');
        expect(getOrderTypeLabel('ridicari')).toBe('Ridicare');
    });

    it('echoes an unknown type rather than hiding it', () => {
        expect(getOrderTypeLabel('altceva')).toBe('altceva');
    });

    it('returns N/A for an absent type', () => {
        expect(getOrderTypeLabel('')).toBe('N/A');
        expect(getOrderTypeLabel(undefined as unknown as string)).toBe('N/A');
    });
});

describe('formatDate', () => {
    it('renders dd.mm.yyyy in the Romanian locale', () => {
        expect(formatDate('2026-03-15')).toBe('15.03.2026');
    });

    it('returns N/A for an empty input', () => {
        expect(formatDate('')).toBe('N/A');
    });

    it('does not throw on an unparseable date', () => {
        expect(() => formatDate('garbage')).not.toThrow();
    });
});
