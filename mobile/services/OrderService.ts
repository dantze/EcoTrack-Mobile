import { apiFetch } from './http';

export const OrderService = {
    getOrders: async () => {
        try {
            const response = await apiFetch('/orders');
            if (!response.ok) throw new Error('Eșec la preluarea comenzilor');
            return await response.json();
        } catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }
    },

    deleteOrder: async (id: number) => {
        try {
            const response = await apiFetch(`/orders/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Eșec la ștergerea comenzii');
        } catch (error) {
            console.error('Error deleting order:', error);
            throw error;
        }
    },

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

    updateOrder: async (id: number, data: any) => {
        try {
            const response = await apiFetch(`/orders/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('Eșec la actualizarea comenzii');
            return await response.json();
        } catch (error) {
            console.error('Error updating order:', error);
            throw error;
        }
    },

    getOrdersByRoute: async (routeId: number) => {
        try {
            const response = await apiFetch(`/route-definitions/${routeId}/orders`);
            if (!response.ok) throw new Error('Eșec la preluarea comenzilor rutei');
            return await response.json();
        } catch (error) {
            console.error('Error fetching route orders:', error);
            throw error;
        }
    }
};
