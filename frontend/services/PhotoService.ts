import { API_BASE_URL } from '../constants/ApiConfig';

/**
 * PhotoService handles all photo-related communication with the backend.
 * Photos are stored in DigitalOcean Spaces via the backend API.
 */
export const PhotoService = {

    /**
     * Uploads an ID photo for a specific client to DigitalOcean Spaces.
     * The backend handles naming (clientId_FullName) and folder placement (persoane fizice/).
     * 
     * @param clientId The backend client ID.
     * @param photoUri The local URI of the photo (from ImagePicker).
     * @returns The server response message (includes the public URL).
     */
    uploadIdPhoto: async (clientId: number, photoUri: string): Promise<string> => {
        const formData = new FormData();

        // Extract filename and MIME type from URI
        const filename = photoUri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        // React Native FormData expects an object with uri, name, type
        // @ts-ignore
        formData.append('file', { uri: photoUri, name: filename, type });

        console.log(`[PhotoService] Uploading photo for client ${clientId}...`);

        const response = await fetch(`${API_BASE_URL}/${clientId}/idPhoto`, {
            method: 'POST',
            headers: {
                // Do NOT set Content-Type manually — fetch sets it with the correct multipart boundary
                'Accept': 'application/json',
            },
            body: formData,
        });

        const responseText = await response.text();
        console.log(`[PhotoService] Upload response: ${responseText}`);

        if (!response.ok) {
            throw new Error(responseText || 'Eșec la încărcarea fotografiei');
        }

        return responseText;
    },

    /**
     * Deletes the ID photo for a specific client from DigitalOcean Spaces.
     * Also clears the idPhotoUrl field in the database.
     * 
     * @param clientId The backend client ID.
     * @returns The server response message.
     */
    deleteIdPhoto: async (clientId: number): Promise<string> => {
        console.log(`[PhotoService] Deleting photo for client ${clientId}...`);

        const response = await fetch(`${API_BASE_URL}/${clientId}/idPhoto`, {
            method: 'DELETE',
        });

        const responseText = await response.text();
        console.log(`[PhotoService] Delete response: ${responseText}`);

        if (!response.ok) {
            throw new Error(responseText || 'Eșec la ștergerea fotografiei');
        }

        return responseText;
    },

    /**
     * Fetches the list of all photo URLs from the bucket.
     * 
     * @returns Array of public photo URLs.
     */
    getAllPhotos: async (): Promise<string[]> => {
        console.log(`[PhotoService] Fetching all photos...`);

        const response = await fetch(`${API_BASE_URL}/photos`);

        if (!response.ok) {
            throw new Error('Eșec la preluarea fotografiilor');
        }

        return await response.json();
    },

    /**
     * Uploads multiple task completion photos to DigitalOcean Spaces.
     * Photos are stored under the "task_photos/" folder.
     * 
     * @param taskId The task ID.
     * @param photoUris Array of local photo URIs (from ImagePicker).
     * @returns Object with { uploaded: number, urls: string[] }
     */
    uploadTaskPhotos: async (taskId: number, photoUris: string[]): Promise<{ uploaded: number; urls: string[] }> => {
        const formData = new FormData();

        for (const uri of photoUris) {
            const filename = uri.split('/').pop() || 'photo.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            // @ts-ignore - React Native FormData expects { uri, name, type }
            formData.append('files', { uri, name: filename, type });
        }

        console.log(`[PhotoService] Uploading ${photoUris.length} task photos for task ${taskId}...`);

        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/photos`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
            },
            body: formData,
        });

        const responseData = await response.json();
        console.log(`[PhotoService] Task photos upload response:`, responseData);

        if (!response.ok) {
            throw new Error('Eșec la încărcarea pozelor sarcinii');
        }

        return responseData;
    },
};
