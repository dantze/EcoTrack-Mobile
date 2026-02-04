import { API_BASE_URL } from '../constants/ApiConfig';

// Definim structura datelor pentru crearea unei rute
export interface CreateRouteData {
    date: string;
    county?: string;
    employeeId?: number;
}

export interface Route {
    id: number;
    date: string;
    county?: string;
    employeeId: number;
    employeeName: string;
    tasks: any[];
}

export const RouteService = {
   
    getAllRoutes: async () => {
        const response = await fetch(`${API_BASE_URL}/routes`);
        if (!response.ok) {
            throw new Error('Eșec la preluarea rutelor');
        }
        return await response.json();
    },

    getRoutesByCounty: async (county: string): Promise<Route[]> => {
        const response = await fetch(`${API_BASE_URL}/routes/county/${encodeURIComponent(county)}`);
        if (!response.ok) {
            throw new Error('Eșec la preluarea rutelor');
        }
        return await response.json();
    },

    getRoutesByEmployeeId: async (employeeId: number): Promise<Route[]> => {
        const response = await fetch(`${API_BASE_URL}/routes/employee/${employeeId}`);
        if (!response.ok) {
            throw new Error('Eșec la preluarea rutelor șoferului');
        }
        return await response.json();
    },

    getRouteById: async (routeId: number): Promise<Route> => {
        const response = await fetch(`${API_BASE_URL}/routes/${routeId}`);
        if (!response.ok) {
            throw new Error('Ruta nu a fost găsită');
        }
        return await response.json();
    },

    
    createRoute: async (routeData: CreateRouteData) => {
        const response = await fetch(`${API_BASE_URL}/routes`, {
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
        const response = await fetch(`${API_BASE_URL}/routes/${routeId}/assign-driver/${employeeId}`, {
            method: 'PUT',
        });

        if (!response.ok) {
            throw new Error('Eșec la asignarea șoferului');
        }
        return await response.json();
    }
};