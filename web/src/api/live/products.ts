/**
 * ProductController — /api/products
 *
 * `remove()` is a SOFT delete: the controller flips isActive to false. The
 * product disappears from list() but is still returned by listAll(), and every
 * order that already referenced it keeps resolving its name and price.
 *
 * It answers 409 while UNFINISHED orders still use it — the same strict "no
 * COMPLETED task" rule as subscriptions. The Romanian message arrives in the
 * standard error body, under `message`; it used to be under `error`, which was
 * this endpoint's own invention and is gone (TODO-38c).
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

  async listAll(): Promise<Product[]> {
    const raw = await request<RawProduct[]>('/products/all');
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
