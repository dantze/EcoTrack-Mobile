import { API_BASE_URL } from '../constants/ApiConfig';

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
 * Obține toți angajații
 */
export const getAllEmployees = async (): Promise<Employee[]> => {
    const response = await fetch(`${API_BASE_URL}/employees`);
    if (!response.ok) {
        throw new Error('Eroare la încărcarea angajaților');
    }
    return response.json();
};

/**
 * Obține un angajat după ID
 */
export const getEmployeeById = async (id: number): Promise<Employee> => {
    const response = await fetch(`${API_BASE_URL}/employees/${id}`);
    if (!response.ok) {
        throw new Error('Angajatul nu a fost găsit');
    }
    return response.json();
};

/**
 * Obține toți șoferii (angajați cu rolul DRIVER)
 */
export const getAllDrivers = async (): Promise<Employee[]> => {
    const response = await fetch(`${API_BASE_URL}/employees/drivers`);
    if (!response.ok) {
        throw new Error('Eroare la încărcarea șoferilor');
    }
    return response.json();
};

/**
 * Obține angajații cu un anumit rol
 */
export const getEmployeesByRole = async (roleName: string): Promise<Employee[]> => {
    const response = await fetch(`${API_BASE_URL}/employees/role/${roleName}`);
    if (!response.ok) {
        throw new Error('Eroare la încărcarea angajaților');
    }
    return response.json();
};
