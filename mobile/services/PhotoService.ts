import { apiFetch, messageFromBody } from './http';

/**
 * PhotoService handles all photo-related communication with the backend.
 * Photos are stored in DigitalOcean Spaces via the backend API.
 */
export const PhotoService = {

    // uploadIdPhoto / deleteIdPhoto / getAllPhotos lived here (TODO-14).
    //
    // The first two called POST and DELETE on the client's ID photo route,
    // which no longer exists: EcoTrack does not store photographs of identity
    // documents any more. Scanning moved to the web app with the rest of Sales
    // (TODO-33), where it also reads the card in the browser and keeps nothing.
    // The objects those uploads created have since been drained and the column
    // that recorded them is gone (TODO-45).
    //
    // getAllPhotos called GET /api/photos, which listed the ENTIRE bucket to
    // any authenticated employee - while ID photos were stored, that was one
    // call for every scanned identity card in the company. Nothing used it.

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

            // @ts-expect-error React Native FormData expects { uri, name, type }
            formData.append('files', { uri, name: filename, type });
        }

        console.log(`[PhotoService] Uploading ${photoUris.length} task photos for task ${taskId}...`);

        const response = await apiFetch(`/tasks/${taskId}/photos`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
            },
            body: formData,
        });

        // Read the body ONCE, as text. `response.json()` was called before the
        // status was checked, so a refusal whose body is not JSON — a proxy's
        // error page — threw a parse error instead of the failure, and a
        // refusal whose body IS JSON had already been consumed by the time
        // anyone wanted its message (TODO-51).
        const responseText = await response.text();
        console.log(`[PhotoService] Task photos upload response:`, responseText);

        if (!response.ok) {
            const message = messageFromBody(response.status, responseText);
            throw new Error(message ?? 'Eșec la încărcarea pozelor sarcinii');
        }

        return JSON.parse(responseText);
    },
};
