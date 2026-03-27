import { API_BASE_URL } from '../constants/ApiConfig';

export type ClientType = 'individual' | 'company';

export interface ClientData {
    type: ClientType;
    email: string;
    phone: string;
    address: string;
    name?: string; // For companies
    CUI?: string; // For companies
    adminName?: string; // For companies
    fullName?: string; // For individuals
    cnp?: string | null; // For individuals (CNP)
}

export const ClientService = {
    /**
     * Fetches all clients from the backend.
     */
    getClients: async () => {
        const response = await fetch(`${API_BASE_URL}/clients`);
        if (!response.ok) {
            throw new Error('Eșec la preluarea clienților');
        }
        return await response.json();
    },

    /**
     * Creates a new client.
     * @param clientData The data for the new client.
     */
    createClient: async (clientData: ClientData) => {
        const response = await fetch(`${API_BASE_URL}/clients`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(clientData),
        });

        if (!response.ok) {
            throw new Error('Răspunsul de la rețea nu a fost ok');
        }

        return await response.json();
    },

    /**
     * Creates a new order for a specific client.
     * @param clientId The ID of the client.
     * @param orderData The data for the new order.
     */
    createOrder: async (clientId: number, orderData: any) => {
        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || 'Eșec la crearea comenzii');
        }

        return await response.json();
    },

    /**
     * Fetches all orders for a specific client.
     * @param clientId The ID of the client.
     */
    getOrders: async (clientId: number) => {
        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/orders`);
        if (!response.ok) {
            throw new Error('Eșec la preluarea comenzilor');
        }
        return await response.json();
    },

    /**
     * Updates a client by ID.
     * @param clientId The ID of the client to update.
     * @param clientData The updated client data.
     */
    updateClient: async (clientId: number, clientData: ClientData) => {
        const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(clientData),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Update client error:', response.status, errText);
            throw new Error(errText || `Eșec la actualizarea clientului (${response.status})`);
        }

        return await response.json();
    },

    /**
     * Checks if a client has orders in the database.
     * @param clientId The ID of the client.
     */
    checkClientHasOrders: async (clientId: number): Promise<boolean> => {
        const response = await fetch(`${API_BASE_URL}/clients/${clientId}/has-orders`);
        if (!response.ok) {
            throw new Error('Eșec la verificarea comenzilor clientului');
        }
        const data = await response.json();
        return data.hasOrders;
    },

    /**
     * Deletes a client by ID.
     * @param clientId The ID of the client to delete.
     * @param cascade If true, also deletes all orders (and their tasks) associated with the client.
     */
    deleteClient: async (clientId: number, cascade: boolean = false) => {
        const url = cascade
            ? `${API_BASE_URL}/clients/${clientId}?cascade=true`
            : `${API_BASE_URL}/clients/${clientId}`;
        const response = await fetch(url, {
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error('Eșec la ștergerea clientului');
        }
    },

    /**
     * Uploads an ID photo for a specific client.
     * @param clientId The ID of the client (backend ID).
     * @param photoUri The local URI of the photo to upload.
     */
    uploadIdPhoto: async (clientId: number, photoUri: string) => {
        // Create FormData
        const formData = new FormData();

        // Infer filename and type
        const filename = photoUri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        // Append file
        // @ts-ignore: React Native FormData expects an object with uri, name, type
        formData.append('file', { uri: photoUri, name: filename, type });

        console.log(`Uploading photo for client ${clientId} to ${API_BASE_URL}/${clientId}/idPhoto`);

        const response = await fetch(`${API_BASE_URL}/${clientId}/idPhoto`, {
            method: 'POST',
            headers: {
                // Content-Type header must NOT be set manually for FormData; fetch sets it with boundary
                'Accept': 'application/json',
            },
            body: formData,
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || 'Eșec la încărcarea pozei');
        }

        // The endpoint returns a plain string, so use .text() instead of .json()
        return await response.text();
    }
};
