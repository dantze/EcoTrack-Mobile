import { apiError, apiFetch } from './http';

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

/**
 * The one route call the driver app makes (TODO-33): "which routes are mine".
 * Creating a route, assigning a driver, reordering stops and deleting all
 * belonged to the Technical section, which now lives only in `web/`.
 */
export const RouteService = {

    getRoutesByEmployeeId: async (employeeId: number): Promise<Route[]> => {
        const response = await apiFetch(`/routes/employee/${employeeId}`);
        if (!response.ok) {
            throw await apiError(response, 'Eșec la preluarea rutelor șoferului');
        }
        return await response.json();
    },
};
