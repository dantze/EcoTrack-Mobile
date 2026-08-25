/**
 * Searchable client picker for the order form.
 *
 * The mobile app makes this a whole screen (CreateOrder.tsx) that filters on
 * name / CUI / email / phone. Same matching rules, but inline: a filter box
 * over a short scrolling list, collapsing to a summary line once picked.
 */

import { useMemo, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import { type Client, clientName } from '@/types/domain';
import { SearchInput } from './FilterBar';

/** name / full name / email / phone / CUI, as in CreateOrder.filterClients. */
export function matchesClient(client: Client, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    clientName(client),
    client.email ?? '',
    client.phone ?? '',
    client.address ?? '',
    client.type === 'company' ? (client.CUI ?? '') : (client.CNP ?? ''),
  ];
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

function clientMeta(client: Client): string {
  const parts =
    client.type === 'company'
      ? [client.CUI ? `CUI ${client.CUI}` : null, client.adminName]
      : [client.CNP ? `CNP ${client.CNP}` : null];
  return [...parts, client.phone, client.email].filter(Boolean).join(' · ');
}

export function ClientPicker({
  clients,
  loading,
  selected,
  onSelect,
  error,
}: {
  clients: Client[];
  loading: boolean;
  selected: Client | null;
  onSelect: (client: Client | null) => void;
  error?: string;
}) {
  const [query, setQuery] = useState('');

  const matches = useMemo(
    () => clients.filter((client) => matchesClient(client, query)).slice(0, 50),
    [clients, query],
  );

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-sunken px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {clientName(selected)}{' '}
            <span className="text-xs font-normal text-ink-subtle">
              {selected.type === 'company' ? 'PJ' : 'PF'}
            </span>
          </p>
          <p className="truncate text-xs text-ink-muted">{clientMeta(selected) || '—'}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>
          Schimbă
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Caută client (nume, CUI, email, telefon)"
        width="w-full"
      />
      <div
        className={`max-h-56 overflow-y-auto rounded-md border ${error ? 'border-red-400' : 'border-border'}`}
      >
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : matches.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-muted">Nu s-au găsit clienți.</p>
        ) : (
          matches.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => onSelect(client)}
              className="flex w-full flex-col items-start border-b border-border/60 px-3 py-1.5 text-left last:border-b-0 hover:bg-surface-sunken"
            >
              <span className="text-sm text-ink">
                {clientName(client)}{' '}
                <span className="text-xs text-ink-subtle">
                  {client.type === 'company' ? 'PJ' : 'PF'}
                </span>
              </span>
              <span className="text-xs text-ink-muted">{clientMeta(client) || '—'}</span>
            </button>
          ))
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
