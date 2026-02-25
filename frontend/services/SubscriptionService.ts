import { API_BASE_URL } from '../constants/ApiConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionType = 'ONE_TIME' | 'RECURRING';

export interface Subscription {
    id: number;
    name: string;
    description: string | null;
    type: SubscriptionType;
    price: number;
    visitsPerMonth: number | null;   // null for ONE_TIME
    durationMonths: number | null;   // null for ONE_TIME or open-ended RECURRING
    isIndefinite: boolean | null;    // null for ONE_TIME
    isActive: boolean;
}

export interface CreateSubscriptionRequest {
    name: string;
    description?: string | null;
    type: SubscriptionType;
    price: number;
    visitsPerMonth?: number | null;
    durationMonths?: number | null;
    isIndefinite?: boolean | null;
    isActive?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const SubscriptionService = {

    /**
     * Get all active subscription plans — used for frontend order dropdowns
     */
    getActiveSubscriptions: async (): Promise<Subscription[]> => {
        const response = await fetch(`${API_BASE_URL}/subscriptions`);
        if (!response.ok) throw new Error('Eșec la preluarea abonamentelor');
        return await response.json();
    },

    /**
     * Get all subscription plans including retired ones — used for admin views
     */
    getAllSubscriptions: async (): Promise<Subscription[]> => {
        const response = await fetch(`${API_BASE_URL}/subscriptions/all`);
        if (!response.ok) throw new Error('Eșec la preluarea abonamentelor');
        return await response.json();
    },

    /**
     * Get a single subscription by ID
     */
    getSubscriptionById: async (id: number): Promise<Subscription> => {
        const response = await fetch(`${API_BASE_URL}/subscriptions/${id}`);
        if (!response.ok) throw new Error('Abonamentul nu a fost găsit');
        return await response.json();
    },

    /**
     * Create a new subscription plan
     */
    createSubscription: async (subscription: CreateSubscriptionRequest): Promise<Subscription> => {
        const response = await fetch(`${API_BASE_URL}/subscriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
        });
        if (!response.ok) throw new Error('Eșec la crearea abonamentului');
        return await response.json();
    },

    /**
     * Update an existing subscription plan
     */
    updateSubscription: async (id: number, subscription: CreateSubscriptionRequest): Promise<Subscription> => {
        const response = await fetch(`${API_BASE_URL}/subscriptions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
        });
        if (!response.ok) throw new Error('Eșec la actualizarea abonamentului');
        return await response.json();
    },

    /**
     * Soft-delete (deactivate) a subscription plan — does NOT remove it from DB
     * so existing orders referencing it are never broken
     */
    deactivateSubscription: async (id: number): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/subscriptions/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok && response.status !== 204) {
            throw new Error('Eșec la dezactivarea abonamentului');
        }
    },
};
