import { apiFetch } from './http';

export interface Product {
    id: number;
    name: string;
    description: string | null;
    price: number;
}

export interface CreateProductRequest {
    name: string;
    description?: string | null;
    price: number;
}

export interface UpdateProductRequest {
    name: string;
    description?: string | null;
    price: number;
}

export interface DeleteProductResult {
    success: boolean;
    error?: string;
}

export const ProductService = {
    /**
     * Get all products
     */
    getAllProducts: async (): Promise<Product[]> => {
        const response = await apiFetch('/products');
        if (!response.ok) throw new Error('Eșec la preluarea produselor');
        return await response.json();
    },

    /**
     * Get product by ID
     */
    getProductById: async (id: number): Promise<Product> => {
        const response = await apiFetch(`/products/${id}`);
        if (!response.ok) throw new Error('Produsul nu a fost găsit');
        return await response.json();
    },

    /**
     * Create a new product
     */
    createProduct: async (product: CreateProductRequest): Promise<Product> => {
        const response = await apiFetch('/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(product),
        });

        if (!response.ok) {
            throw new Error('Eșec la crearea produsului');
        }

        return await response.json();
    },

    /**
     * Update an existing product
     */
    updateProduct: async (id: number, product: UpdateProductRequest): Promise<Product> => {
        const response = await apiFetch(`/products/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(product),
        });

        if (!response.ok) {
            throw new Error('Eșec la actualizarea produsului');
        }

        return await response.json();
    },

    /**
     * Delete a product
     * Returns success status and error message if product is in use
     */
    deleteProduct: async (id: number): Promise<DeleteProductResult> => {
        const response = await apiFetch(`/products/${id}`, {
            method: 'DELETE',
        });

        if (response.ok || response.status === 204) {
            return { success: true };
        }

        if (response.status === 409) {
            // Refused: unfinished orders still use the product.
            //
            // `message`, NOT `error` (TODO-38c). This endpoint used to build its
            // own body with the Romanian text under `error`; it now goes through
            // GlobalExceptionHandler like everything else, which puts the HTTP
            // status reason under `error` and the text under `message`. Reading
            // `error` here would show the user the word "Conflict".
            const data = await response.json().catch(() => null);
            return {
                success: false,
                error: data?.message || 'Produsul este folosit în comenzi nefinalizate.'
            };
        }

        return {
            success: false,
            error: 'Eșec la ștergerea produsului'
        };
    },
};
