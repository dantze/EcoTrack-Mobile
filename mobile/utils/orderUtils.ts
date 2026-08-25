import { Order, isAmplasare, isRidicari, isIgienizari } from '../types/OrderTypes';

// ─── Date display ─────────────────────────────────────────────────────────────
export type DateInfo =
    | { isRange: true; start: { m: string; d: number }; end: { m: string; d: number } }
    | { isRange: false; m: string; d: string | number };

const MONTHS = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const getDateInfo = (order: Order): DateInfo => {
    const parse = (s?: string): Date | null => (s ? new Date(s) : null);
    const valid = (d: Date | null): d is Date => !!d && !isNaN(d.getTime());

    let primary: Date | null = null;
    let end: Date | null = null;

    if (isAmplasare(order)) {
        primary = parse(order.startDate);
        end = parse(order.endDate);
    } else if (isRidicari(order)) {
        primary = parse(order.pickupDate);
    } else if (isIgienizari(order)) {
        primary = parse(order.sanitationDate);
    }

    if (valid(primary)) {
        const m1 = MONTHS[primary.getMonth()];
        const d1 = primary.getDate();
        if (valid(end) && primary.getTime() !== end.getTime()) {
            const sameDay =
                d1 === end.getDate() &&
                primary.getMonth() === end.getMonth() &&
                primary.getFullYear() === end.getFullYear();
            if (!sameDay) {
                return {
                    isRange: true,
                    start: { m: m1, d: d1 },
                    end: { m: MONTHS[end.getMonth()], d: end.getDate() },
                };
            }
        }
        return { isRange: false, m: m1, d: d1 };
    }
    return { isRange: false, m: 'N/A', d: '--' };
};

// ─── Client display name ──────────────────────────────────────────────────────
export const getClientName = (order: Order): string => {
    const c = order.client;
    return c?.fullName || c?.name || c?.email || 'Client necunoscut';
};

// ─── Location display text ────────────────────────────────────────────────────
const formatCoords = (coords?: string): string | null => {
    if (!coords) return null;
    const parts = coords.split(',');
    return parts.length === 2
        ? `${parts[0].substring(0, 9)}, ${parts[1].substring(0, 9)}`
        : coords;
};

export const getLocationText = (order: Order): string => {
    if (isAmplasare(order)) {
        return (
            order.locationAddress ||
            formatCoords(order.locationCoordinates) ||
            order.client?.address ||
            'Locație nespecificată'
        );
    }
    if (isRidicari(order)) {
        return (
            order.pickupLocationAddress ||
            formatCoords(order.pickupLocationCoordinates) ||
            order.client?.address ||
            'Locație nespecificată'
        );
    }
    if (isIgienizari(order)) {
        return (
            order.sanitationLocationAddress ||
            formatCoords(order.sanitationLocationCoordinates) ||
            order.client?.address ||
            'Locație nespecificată'
        );
    }
    return 'Locație nespecificată';
};

// ─── Action text ──────────────────────────────────────────────────────────────
export const getActionText = (order: Order): string => {
    if (isAmplasare(order)) return `Amplasare (x${order.quantity || 1})`;
    if (isRidicari(order)) return `Ridicare (x${order.pickupQuantity || 1})`;
    if (isIgienizari(order))
        return order.subscription ? `Igienizare · ${order.subscription.name}` : 'Igienizare';
    return 'Comandă';
};

// ─── Order type label (Romanian) ──────────────────────────────────────────────
export const getOrderTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        amplasari: 'Amplasare',
        igienizari: 'Igienizare',
        ridicari: 'Ridicare',
    };
    return labels[type?.toLowerCase()] || type || 'N/A';
};

// ─── Format date string (Romanian locale) ─────────────────────────────────────
export const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ro-RO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
};
