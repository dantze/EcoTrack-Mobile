import { API_BASE_URL } from '../constants/ApiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LoginResponse {
    id: number;
    username: string;
    fullName: string;
    phone: string;
    county: string | null;
    roles: string[];
    message: string;
    success: boolean;
}

export interface User {
    id: number;
    username: string;
    fullName: string;
    phone: string;
    county: string | null;
    roles: string[];
}

const USER_STORAGE_KEY = '@ecotrack_user';
const ACTIVE_DRIVER_KEY = '@ecotrack_active_driver';

export const AuthService = {
    /**
     * Login with username and password
     */
    login: async (username: string, password: string): Promise<LoginResponse> => {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data: LoginResponse = await response.json();

        if (data.success) {
            // Store user in AsyncStorage
            const user: User = {
                id: data.id,
                username: data.username,
                fullName: data.fullName,
                phone: data.phone,
                county: data.county,
                roles: data.roles,
            };
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        }

        return data;
    },

    /**
     * Get the currently logged in user
     */
    getCurrentUser: async (): Promise<User | null> => {
        try {
            const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
            if (userJson) {
                return JSON.parse(userJson);
            }
        } catch (error) {
            console.error('Error getting current user:', error);
        }
        return null;
    },

    /**
     * Logout the current user
     */
    logout: async (): Promise<void> => {
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        await AsyncStorage.removeItem(ACTIVE_DRIVER_KEY);
    },

    /**
     * Check if user has a specific role
     */
    hasRole: (user: User | null, role: string): boolean => {
        if (!user || !user.roles) return false;
        return user.roles.includes(role);
    },

    /**
     * Check if user is a driver
     */
    isDriver: (user: User | null): boolean => {
        return AuthService.hasRole(user, 'DRIVER');
    },

    /**
     * Check if user is sales or tech (office staff)
     */
    isOfficeStaff: (user: User | null): boolean => {
        return AuthService.hasRole(user, 'SALES') || AuthService.hasRole(user, 'TECH');
    },

    /**
     * Set the active driver (for admin impersonation)
     */
    setActiveDriver: async (driverId: number, driverName: string): Promise<void> => {
        await AsyncStorage.setItem(ACTIVE_DRIVER_KEY, JSON.stringify({ id: driverId, fullName: driverName }));
    },

    /**
     * Get the active driver (returns the impersonated driver, or null)
     */
    getActiveDriver: async (): Promise<{ id: number; fullName: string } | null> => {
        try {
            const json = await AsyncStorage.getItem(ACTIVE_DRIVER_KEY);
            if (json) {
                return JSON.parse(json);
            }
        } catch (error) {
            console.error('Error getting active driver:', error);
        }
        return null;
    },

    /**
     * Clear the active driver selection
     */
    clearActiveDriver: async (): Promise<void> => {
        await AsyncStorage.removeItem(ACTIVE_DRIVER_KEY);
    },
};
