// ─── Shared client shape ────────────────────────────────────────────────────
export type OrderClient = {
    id: number;
    type?: string;
    fullName?: string;
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
    cui?: string;
};

// ─── Discriminated Union Order types ─────────────────────────────────────────
export type AmplasareOrder = {
    orderType: 'Amplasari';
    id: number;
    number?: number;
    date?: string;
    contact: string;
    details: string;
    client: OrderClient;
    quantity: number;
    locationCoordinates?: string;
    locationAddress?: string;
    startDate?: string;
    endDate?: string;
    durationDays?: number;
    igienizariPerMonth?: number;
    isIndefinite?: boolean;
    product?: { id: number; name: string; price?: number; description?: string };
};

export type RidicareOrder = {
    orderType: 'Ridicari';
    id: number;
    number?: number;
    date?: string;
    contact: string;
    details: string;
    client: OrderClient;
    pickupDate?: string;
    pickupQuantity?: number;
    pickupProductName?: string;
    pickupLocationAddress?: string;
    pickupLocationCoordinates?: string;
    product?: { id: number; name: string; price?: number; description?: string };
};

export type IgienizareOrder = {
    orderType: 'Igienizari';
    id: number;
    number?: number;
    date?: string;
    contact: string;
    details: string;
    client: OrderClient;
    sanitationDate?: string;
    sanitationLocationAddress?: string;
    sanitationLocationCoordinates?: string;
    subscription?: { id: number; name: string; type: string; price: number; visitsPerMonth?: number };
};

export type Order = AmplasareOrder | RidicareOrder | IgienizareOrder;

// ─── Type guards ──────────────────────────────────────────────────────────────
export const isAmplasare = (o: Order): o is AmplasareOrder => o.orderType === 'Amplasari';
export const isRidicari = (o: Order): o is RidicareOrder => o.orderType === 'Ridicari';
export const isIgienizari = (o: Order): o is IgienizareOrder => o.orderType === 'Igienizari';

// ─── Task status map ──────────────────────────────────────────────────────────
export type OrderTaskMap = { [orderId: number]: boolean };
