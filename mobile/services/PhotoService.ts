import { apiFetch } from './http';

/**
 * PhotoService handles all photo-related communication with the backend.
 * Photos are stored in DigitalOcean Spaces via the backend API.
 */
export const PhotoService = {

    // uploadIdPhoto / deleteIdPhoto / getAllPhotos lived here (TODO-14).
    //
    // The first two called POST and DELETE /{clientId}/idPhoto, which no
    // longer exist: EcoTrack does not store photographs of identity documents
    // any more. IdScanService reads the card on this phone and keeps nothing.
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

        const responseData = await response.json();
        console.log(`[PhotoService] Task photos upload response:`, responseData);

        if (!response.ok) {
            throw new Error('Eșec la încărcarea pozelor sarcinii');
        }

        return responseData;
    },
};
