import { apiFetch } from './http';

// Definim structura datelor pentru crearea unei rute
export interface CreateRouteData {
    name: string;
    /**
     * 1=Luni, 2=Marți, ..., 7=Duminică.
     *
     * A route is WEEKLY, not dated — it recurs on its weekday, so changing it
     * changes every week from now on. The old `date` field is gone for exactly
     * that reason.
     */
    dayOfWeek?: number;
    county?: string;
    employeeId?: number;
}

export interface Route {
    id: number;
    name: string;
    /** 1=Luni, 2=Marți, ..., 7=Duminică. Weekly, never dated. */
    dayOfWeek?: number;
    county?: string;
    employeeId: number;
    employeeName: string;
    tasks: any[];
}

export const RouteService = {

    getAllRoutes: async () => {
        const response = await apiFetch('/routes');
        if (!response.ok) {
            throw new Error('Eșec la preluarea rutelor');
        }
        return await response.json();
    },

    getRoutesByEmployeeId: async (employeeId: number): Promise<Route[]> => {
        const response = await apiFetch(`/routes/employee/${employeeId}`);
        if (!response.ok) {
            throw new Error('Eșec la preluarea rutelor șoferului');
        }
        return await response.json();
    },

    getRoutesByEmployeeIdAndDayOfWeek: async (employeeId: number, dayOfWeek: number): Promise<Route[]> => {
        const response = await apiFetch(`/routes/employee/${employeeId}/day/${dayOfWeek}`);
        if (!response.ok) {
            throw new Error('Eșec la preluarea rutelor șoferului');
        }
        return await response.json();
    },

    getRouteById: async (routeId: number): Promise<Route> => {
        const response = await apiFetch(`/routes/${routeId}`);
        if (!response.ok) {
            throw new Error('Ruta nu a fost găsită');
        }
        return await response.json();
    },


    createRoute: async (routeData: CreateRouteData) => {
        const response = await apiFetch('/routes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(routeData),
        });

        if (!response.ok) {
            throw new Error('Eșec la crearea rutei');
        }
        return await response.json();
    },

    assignDriverToRoute: async (routeId: number, employeeId: number): Promise<Route> => {
        const response = await apiFetch(`/routes/${routeId}/assign-driver/${employeeId}`, {
            method: 'PUT',
        });

        if (!response.ok) {
            throw new Error('Eșec la asignarea șoferului');
        }
        return await response.json();
    },

    reorderTasks: async (routeId: number, taskIds: number[]): Promise<Route> => {
        const response = await apiFetch(`/routes/${routeId}/reorder-tasks`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskIds),
        });

        if (!response.ok) {
            throw new Error('Eșec la reordonarea sarcinilor');
        }
        return await response.json();
    },

    deleteRoute: async (routeId: number): Promise<void> => {
        const response = await apiFetch(`/routes/${routeId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Eșec la ștergerea rutei');
        }
    },
};