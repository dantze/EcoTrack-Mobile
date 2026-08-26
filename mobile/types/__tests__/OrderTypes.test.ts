import { describe, it, expect } from 'vitest';
import {
    isAmplasare,
    isRidicari,
    isIgienizari,
    type Order,
} from '../OrderTypes';

/**
 * The three discriminator strings are duplicated in three places: the backend's
 * Jackson `@JsonSubTypes` list, `web/src/features/sales/orderModel.ts`, and here.
 * The backend side is pinned by `DomainTests/OrderJsonSubTypesTest`; this is the
 * mobile side. Renaming one without the others silently routes every order to
 * the fallback branch.
 */

const base = { id: 1, contact: '0700000000', details: '', client: { id: 1 } };

const amplasare = { ...base, orderType: 'Amplasari', quantity: 1 } as Order;
const ridicare = { ...base, orderType: 'Ridicari' } as Order;
const igienizare = { ...base, orderType: 'Igienizari' } as Order;

describe('order type guards', () => {
    it('each guard matches exactly one subtype', () => {
        expect([isAmplasare(amplasare), isRidicari(amplasare), isIgienizari(amplasare)])
            .toEqual([true, false, false]);
        expect([isAmplasare(ridicare), isRidicari(ridicare), isIgienizari(ridicare)])
            .toEqual([false, true, false]);
        expect([isAmplasare(igienizare), isRidicari(igienizare), isIgienizari(igienizare)])
            .toEqual([false, false, true]);
    });

    it('the discriminators are the exact backend @JsonSubTypes names', () => {
        expect(amplasare.orderType).toBe('Amplasari');
        expect(ridicare.orderType).toBe('Ridicari');
        expect(igienizare.orderType).toBe('Igienizari');
    });

    it('is case-sensitive, so a lowercased wire value matches nothing', () => {
        const lowercased = { ...base, orderType: 'amplasari' } as unknown as Order;
        expect(isAmplasare(lowercased)).toBe(false);
        expect(isRidicari(lowercased)).toBe(false);
        expect(isIgienizari(lowercased)).toBe(false);
    });

    it('no guard claims an unknown order type', () => {
        const unknown = { ...base, orderType: 'Altceva' } as unknown as Order;
        expect(isAmplasare(unknown)).toBe(false);
        expect(isRidicari(unknown)).toBe(false);
        expect(isIgienizari(unknown)).toBe(false);
    });
});
