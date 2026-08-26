import { apiFetch } from './http';

export interface Task {
    id: number;
    type: string;
    status: string;
    scheduledTime?: string;
    scheduledDate?: string; // "YYYY-MM-DD"
    address?: string;
    coordinates?: string;
    clientName?: string;
    clientPhone?: string;
    contactPerson?: string;
    productName?: string;
    quantity?: number;
    internalNotes?: string;
    routeId?: number;
    orderId?: number;
    recurringPlanId?: number;
}

export interface OrderTaskStatus {
    hasTask: boolean;
    taskId: number | null;
    routeId: number | null;
    scheduledTime?: string | null;
}

export const TaskService = {
    /**
     * Get all tasks
     */
    getAllTasks: async (): Promise<Task[]> => {
        const response = await apiFetch('/tasks');
        if (!response.ok) throw new Error('Eșec la preluarea sarcinilor');
        return await response.json();
    },

    /**
     * Get task by ID
     */
    getTaskById: async (id: number): Promise<Task> => {
        const response = await apiFetch(`/tasks/${id}`);
        if (!response.ok) throw new Error('Sarcina nu a fost găsită');
        return await response.json();
    },

    /**
     * Get tasks for a specific route
     */
    getTasksByRouteId: async (routeId: number): Promise<Task[]> => {
        const response = await apiFetch(`/tasks/route/${routeId}`);
        if (!response.ok) throw new Error('Eșec la preluarea sarcinilor rutei');
        return await response.json();
    },

    /**
     * Get tasks for a specific route on a specific date
     */
    getTasksByRouteAndDate: async (routeId: number, date: string): Promise<Task[]> => {
        const response = await apiFetch(`/tasks/route/${routeId}/date/${date}`);
        if (!response.ok) throw new Error('Eșec la preluarea sarcinilor rutei pentru data specificată');
        return await response.json();
    },

    /**
     * Get tasks for a specific employee on a specific scheduled date
     */
    getTasksByEmployeeAndDate: async (employeeId: number, date: string): Promise<Task[]> => {
        const response = await apiFetch(`/tasks/employee/${employeeId}/date/${date}`);
        if (!response.ok) throw new Error('Eșec la preluarea sarcinilor angajatului');
        return await response.json();
    },

    /**
     * Get all tasks for a specific employee (regardless of date)
     */
    getTasksByEmployee: async (employeeId: number): Promise<Task[]> => {
        const response = await apiFetch(`/tasks/employee/${employeeId}`);
        if (!response.ok) throw new Error('Eșec la preluarea sarcinilor angajatului');
        return await response.json();
    },

    /**
     * Create a task from an order and assign it to a route
     */
    createTaskFromOrder: async (orderId: number, routeId: number): Promise<Task> => {
        const response = await apiFetch('/tasks/from-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId, routeId }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Eșec la crearea sarcinii din comandă');
        }

        return await response.json();
    },

    /**
     * Check if an order has an associated task
     */
    checkOrderHasTask: async (orderId: number): Promise<OrderTaskStatus> => {
        const response = await apiFetch(`/tasks/order/${orderId}/exists`);
        if (!response.ok) throw new Error('Eșec la verificarea stării sarcinii');
        return await response.json();
    },

    /**
     * Update task status
     */
    updateTaskStatus: async (taskId: number, status: string): Promise<Task> => {
        const response = await apiFetch(`/tasks/${taskId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error('Eșec la actualizarea stării sarcinii');
        return await response.json();
    },

    /**
     * Delete a task
     */
    deleteTask: async (taskId: number): Promise<void> => {
        const response = await apiFetch(`/tasks/${taskId}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Eșec la ștergerea sarcinii');
    },

    /**
     * Reassign a single task to a different route
     */
    reassignTask: async (taskId: number, newRouteId: number): Promise<Task> => {
        const response = await apiFetch(`/tasks/${taskId}/reassign/${newRouteId}`, {
            method: 'PUT',
        });
        if (!response.ok) throw new Error('Eșec la reasignarea sarcinii');
        return await response.json();
    },

    /**
     * Reassign multiple tasks to a different route
     */
    reassignTasks: async (taskIds: number[], newRouteId: number): Promise<Task[]> => {
        const response = await apiFetch('/tasks/reassign', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ taskIds, newRouteId }),
        });
        if (!response.ok) throw new Error('Eșec la reasignarea sarcinilor');
        return await response.json();
    },

    /**
     * Update scheduled date for a task
     */
    updateScheduledDate: async (taskId: number, scheduledDate: string): Promise<Task> => {
        const response = await apiFetch(`/tasks/${taskId}/scheduled-date`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ scheduledDate }),
        });
        if (!response.ok) throw new Error('Eșec la actualizarea datei programate');
        return await response.json();
    },

    /**
     * Get all photo URLs for a specific task
     */
    getTaskPhotos: async (taskId: number): Promise<string[]> => {
        const response = await apiFetch(`/tasks/${taskId}/photos`);
        if (!response.ok) throw new Error('Eșec la preluarea pozelor sarcinii');
        return await response.json();
    },
};
