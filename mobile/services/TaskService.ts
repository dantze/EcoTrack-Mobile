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

/**
 * The driver app's task calls, and no others (TODO-33).
 *
 * Everything that read the whole task table, created a task from an order,
 * reassigned one to another route or moved its scheduled date belonged to the
 * deleted Sales and Technical screens. What is left is one read of a task, two
 * reads of a day, the status write and the photo list — which is what makes
 * SecurityConfig's note that PATCH /tasks/{id}/status and POST
 * /tasks/{id}/photos are "the only writes the driver app makes" true rather
 * than aspirational. `.github/scripts/cross_project_invariants.py` checks it.
 */
export const TaskService = {
    /**
     * Get task by ID
     */
    getTaskById: async (id: number): Promise<Task> => {
        const response = await apiFetch(`/tasks/${id}`);
        if (!response.ok) throw new Error('Sarcina nu a fost găsită');
        return await response.json();
    },

    /**
     * The signed-in driver's own tasks for a date.
     *
     * Deliberately sends NO employee id: the backend reads it from the access
     * token. Passing an id from the client was the bug - the server never
     * checked it was yours, so any driver could read another's day by changing
     * the number. /tasks/employee/{id} still exists for the office overview and
     * now rejects drivers asking for someone else.
     */
    getMyTasksByDate: async (date: string): Promise<Task[]> => {
        const response = await apiFetch(`/tasks/mine/date/${date}`);
        if (!response.ok) throw new Error('Eșec la preluarea sarcinilor angajatului');
        return await response.json();
    },

    /**
     * Another employee's tasks. OFFICE USE ONLY - the backend returns 403 if a
     * driver-only account asks for an id that is not their own. Drivers use
     * getMyTasksByDate.
     *
     * The one caller left after TODO-33 is an ADMIN picking a driver in
     * Driver/DriverSelection to look at their day; office roles are
     * unrestricted by TaskAccessPolicy, which is what makes that work.
     */
    getTasksByEmployeeAndDate: async (employeeId: number, date: string): Promise<Task[]> => {
        const response = await apiFetch(`/tasks/employee/${employeeId}/date/${date}`);
        if (!response.ok) throw new Error('Eșec la preluarea sarcinilor angajatului');
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
     * Get all photo URLs for a specific task.
     *
     * **These URLs EXPIRE.** Task photos live in a private bucket (TODO-46), so
     * the server signs a short-lived link per request rather than handing out a
     * permanent public one. Render them and drop them; do not write them to
     * AsyncStorage or hold them across a session. `CloudPhotoViewer` keeps them
     * in component state, which is exactly right.
     */
    getTaskPhotos: async (taskId: number): Promise<string[]> => {
        const response = await apiFetch(`/tasks/${taskId}/photos`);
        if (!response.ok) throw new Error('Eșec la preluarea pozelor sarcinii');
        return await response.json();
    },
};
