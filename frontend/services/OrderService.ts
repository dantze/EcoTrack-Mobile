import { API_BASE_URL } from '../constants/ApiConfig';

export const OrderService = {
    getOrders: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/orders`);
            if (!response.ok) throw new Error('Eșec la preluarea comenzilor');
            return await response.json();
        } catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }
    },

    getOrderById: async (id: number) => {
        try {
            const response = await fetch(`${API_BASE_URL}/orders/${id}`);
            if (!response.ok) throw new Error('Eșec la preluarea detaliilor comenzii');
            return await response.json();
        } catch (error) {
            console.error('Error fetching order details:', error);
            throw error;
        }
    },

    updateOrder: async (id: number, data: any) => {
        try {
            const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
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
            const response = await fetch(`${API_BASE_URL}/route-definitions/${routeId}/orders`);
            if (!response.ok) throw new Error('Eșec la preluarea comenzilor rutei');
            return await response.json();
        } catch (error) {
            console.error('Error fetching route orders:', error);
            throw error;
        }
    }
};
