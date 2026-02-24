import { API_BASE_URL } from '../constants/ApiConfig';

export type ClientType = 'individual' | 'company';

export interface ClientData {
    type: ClientType;
    email: string;
    phone: string;
    address: string;
    name?: string; // For companies
    CUI?: string; // For companies
    adminName?: string; // For companies
    fullName?: string; // For individuals
}

export const ClientService = {
    /**
     * Fetches all clients from the backend.
     */
    getClients: async () => {
        const response = await fetch(`${API_BASE_URL}/clients`);
        if (!response.ok) {
            throw new Error('Eșec la preluarea clienților');
        }
        return await response.json();
    },

    /**
     * Creates a new client.
     * @param clientData The data for the new client.
     */
    createClient: async (clientData: ClientData) => {
        const response = await fetch(`${API_BASE_URL}/clients`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(clientData),
        });

        if (!response.ok) {
            throw new Error('Răspunsul de la rețea nu a fost ok');
        }

        return await response.json();
    },

    /**
     * Creates a new order for a specific client.
     * @param clientId The ID of the client.
     * @param orderData The data for the new order.
     */
    createOrder: async (clientId: number, orderData: any) => {
        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || 'Eșec la crearea comenzii');
        }

        return await response.json();
    },

    /**
     * Fetches all orders for a specific client.
     * @param clientId The ID of the client.
     */
    getOrders: async (clientId: number) => {
        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/orders`);
        if (!response.ok) {
            throw new Error('Eșec la preluarea comenzilor');
        }
        return await response.json();
    },
};
