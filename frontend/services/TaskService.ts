import { API_BASE_URL } from '../constants/ApiConfig';

export interface Task {
    id: number;
    type: string;
    status: string;
    scheduledTime?: string;
    address?: string;
    clientName?: string;
    clientPhone?: string;
    internalNotes?: string;
    routeId?: number;
    orderId?: number;
}

export interface OrderTaskStatus {
    hasTask: boolean;
    taskId: number | null;
    routeId: number | null;
}

export const TaskService = {
    /**
     * Get all tasks
     */
    getAllTasks: async (): Promise<Task[]> => {
        const response = await fetch(`${API_BASE_URL}/tasks`);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        return await response.json();
    },

    /**
     * Get task by ID
     */
    getTaskById: async (id: number): Promise<Task> => {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`);
        if (!response.ok) throw new Error('Task not found');
        return await response.json();
    },

    /**
     * Get tasks for a specific route
     */
    getTasksByRouteId: async (routeId: number): Promise<Task[]> => {
        const response = await fetch(`${API_BASE_URL}/tasks/route/${routeId}`);
        if (!response.ok) throw new Error('Failed to fetch route tasks');
        return await response.json();
    },

    /**
     * Create a task from an order and assign it to a route
     */
    createTaskFromOrder: async (orderId: number, routeId: number): Promise<Task> => {
        const response = await fetch(`${API_BASE_URL}/tasks/from-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId, routeId }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to create task from order');
        }

        return await response.json();
    },

    /**
     * Check if an order has an associated task
     */
    checkOrderHasTask: async (orderId: number): Promise<OrderTaskStatus> => {
        const response = await fetch(`${API_BASE_URL}/tasks/order/${orderId}/exists`);
        if (!response.ok) throw new Error('Failed to check order task status');
        return await response.json();
    },

    /**
     * Update task status
     */
    updateTaskStatus: async (taskId: number, status: string): Promise<Task> => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error('Failed to update task status');
        return await response.json();
    },

    /**
     * Delete a task
     */
    deleteTask: async (taskId: number): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete task');
    },

    /**
     * Reassign a single task to a different route
     */
    reassignTask: async (taskId: number, newRouteId: number): Promise<Task> => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/reassign/${newRouteId}`, {
            method: 'PUT',
        });
        if (!response.ok) throw new Error('Failed to reassign task');
        return await response.json();
    },

    /**
     * Reassign multiple tasks to a different route
     */
    reassignTasks: async (taskIds: number[], newRouteId: number): Promise<Task[]> => {
        const response = await fetch(`${API_BASE_URL}/tasks/reassign`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ taskIds, newRouteId }),
        });
        if (!response.ok) throw new Error('Failed to reassign tasks');
        return await response.json();
    },
};
