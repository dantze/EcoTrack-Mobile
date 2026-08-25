/**
 * ClientController — /api/clients
 * PhotosController — /api/{clientId}/idPhoto  (note: NOT under /clients)
 *
 * `Client` is Jackson-polymorphic on `type` ("individual" | "company"), so the
 * discriminator has to survive every write — ClientInput already carries it and
 * is passed through untouched.
 */

import type { ClientInput, ClientsApi } from '../contract';
import type { Client } from '@/types/domain';
import { request } from '../http';
import { extractUrl, normalizeClient, type RawClient } from './normalize';

export const clientsApi: ClientsApi = {
  async list(): Promise<Client[]> {
    const raw = await request<RawClient[]>('/clients');
    return (raw ?? []).map(normalizeClient);
  },

  async get(id: number): Promise<Client> {
    return normalizeClient(await request<RawClient>(`/clients/${id}`));
  },

  async create(input: ClientInput): Promise<Client> {
    return normalizeClient(await request<RawClient>('/clients', { method: 'POST', body: input }));
  },

  async update(id: number, input: ClientInput): Promise<Client> {
    return normalizeClient(
      await request<RawClient>(`/clients/${id}`, { method: 'PUT', body: input }),
    );
  },

  async remove(id: number): Promise<void> {
    // The controller also accepts ?cascade=true, which deletes the client's
    // orders, tasks and photos. The contract exposes no such flag, so this is
    // always the non-cascading delete guarded by hasOrders() in the UI.
    await request<void>(`/clients/${id}`, { method: 'DELETE' });
  },

  async hasOrders(id: number): Promise<boolean> {
    const raw = await request<{ hasOrders?: boolean } | boolean>(`/clients/${id}/has-orders`);
    if (typeof raw === 'boolean') return raw;
    return raw?.hasOrders === true;
  },

  async uploadIdPhoto(clientId: number, file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);

    // Returns a plain sentence with the URL embedded, not JSON.
    const message = await request<string>(`/${clientId}/idPhoto`, {
      method: 'POST',
      body: form,
    });
    return extractUrl(String(message ?? ''));
  },

  async deleteIdPhoto(clientId: number): Promise<string> {
    const message = await request<string>(`/${clientId}/idPhoto`, { method: 'DELETE' });
    return String(message ?? '');
  },
};
