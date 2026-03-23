import { API_BASE_URL } from '../constants/ApiConfig';

export const RecurringIgienizareService = {

    getAll: async () => {
        const response = await fetch(`${API_BASE_URL}/recurring-igienizari`);
        if (!response.ok) throw new Error('Eșec la preluarea igienizărilor recurente');
        return await response.json();
    },

    getActive: async () => {
        const response = await fetch(`${API_BASE_URL}/recurring-igienizari/active`);
        if (!response.ok) throw new Error('Eșec la preluarea igienizărilor recurente active');
        return await response.json();
    },

    getById: async (id: number) => {
        const response = await fetch(`${API_BASE_URL}/recurring-igienizari/${id}`);
        if (!response.ok) throw new Error('Igienizare recurentă nu a fost găsită');
        return await response.json();
    },

    getByClient: async (clientId: number) => {
        const response = await fetch(`${API_BASE_URL}/recurring-igienizari/client/${clientId}`);
        if (!response.ok) throw new Error('Eșec la preluarea igienizărilor recurente ale clientului');
        return await response.json();
    },

    create: async (clientId: number, data: any) => {
        const response = await fetch(`${API_BASE_URL}/recurring-igienizari/client/${clientId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || 'Eșec la crearea igienizării recurente');
        }
        return await response.json();
    },

    assignRoute: async (planId: number, routeId: number) => {
        const response = await fetch(`${API_BASE_URL}/recurring-igienizari/${planId}/assign-route`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ routeId }),
        });
        if (!response.ok) throw new Error('Eșec la atribuirea rutei');
        return await response.json();
    },

    deactivate: async (planId: number) => {
        const response = await fetch(`${API_BASE_URL}/recurring-igienizari/${planId}/deactivate`, {
            method: 'PUT',
        });
        if (!response.ok) throw new Error('Eșec la dezactivarea igienizării recurente');
        return await response.json();
    },
};
