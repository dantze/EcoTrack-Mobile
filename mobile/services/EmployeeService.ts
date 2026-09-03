import { apiFetch } from './http';

export interface EmployeeRole {
    id: number;
    roleName: string;
}

export interface Employee {
    id: number;
    username: string;
    fullName: string;
    phone: string;
    roles: EmployeeRole[];
}

/**
 * Obține toți șoferii (angajați cu rolul DRIVER)
 */
export const getAllDrivers = async (): Promise<Employee[]> => {
    const response = await apiFetch('/employees/drivers');
    if (!response.ok) {
        throw new Error('Eroare la încărcarea șoferilor');
    }
    return response.json();
};
