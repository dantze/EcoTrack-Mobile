import { apiFetch } from './http';

/**
 * One read, for one screen: TaskDetails shows the order behind the task the
 * driver is standing in front of. Listing, updating and deleting orders were
 * the Sales section's, which is now the web app's (TODO-33).
 */
export const OrderService = {
    getOrderById: async (id: number) => {
        try {
            const response = await apiFetch(`/orders/${id}`);
            if (!response.ok) throw new Error('Eșec la preluarea detaliilor comenzii');
            return await response.json();
        } catch (error) {
            console.error('Error fetching order details:', error);
            throw error;
        }
    },
};
