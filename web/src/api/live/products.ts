/**
 * ProductController — /api/products
 *
 * DELETE answers 409 with `{error}` when the product is still referenced by an
 * order; the message arrives as ApiError.body for the UI to surface.
 */

import type { ProductsApi } from '../contract';
import type { Product } from '@/types/domain';
import { request } from '../http';
import { normalizeProduct, type RawProduct } from './normalize';

export const productsApi: ProductsApi = {
  async list(): Promise<Product[]> {
    const raw = await request<RawProduct[]>('/products');
    return (raw ?? []).map(normalizeProduct);
  },

  async create(input: Omit<Product, 'id'>): Promise<Product> {
    return normalizeProduct(await request<RawProduct>('/products', { method: 'POST', body: input }));
  },

  async update(id: number, input: Omit<Product, 'id'>): Promise<Product> {
    // The controller overwrites the body's id from the path, but send it too so
    // the payload is a complete Product either way.
    return normalizeProduct(
      await request<RawProduct>(`/products/${id}`, { method: 'PUT', body: { ...input, id } }),
    );
  },

  async remove(id: number): Promise<void> {
    await request<void>(`/products/${id}`, { method: 'DELETE' });
  },
};
