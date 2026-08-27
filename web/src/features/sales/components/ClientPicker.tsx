/**
 * Client typeahead for the order form.
 *
 * The mobile app makes this a whole screen (CreateOrder.tsx) that filters on
 * name / CUI / email / phone. Same fields, but inline and rankable: results are
 * scored by `lib/search` (diacritic-insensitive, multi-term, fuzzy — a typed
 * "stefan popa" finds "Ștefan Popa" and so does "popa stef"), then nudged by
 * `lib/recents` so the clients this operator worked with recently come first
 * when the query is short and ambiguous.
 *
 * Fully keyboard driven: the search box keeps focus and ↑ ↓ move a highlight
 * through the list, Enter picks, Escape clears the query. The list is a real
 * `listbox` with `aria-activedescendant`, so a screen reader announces the
 * highlighted client without focus ever leaving the input.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner, cx } from '@/components/ui';
import { boost, recordUse } from '@/lib/recents';
import { matchesQuery, rankBy, splitHighlight, type MatchRange } from '@/lib/search';
import { type Client, clientName } from '@/types/domain';
import { SearchInput } from './FilterBar';

/**
 * name / full name / email / phone / address / CUI / CNP, as in
 * CreateOrder.filterClients — but diacritic-insensitive, so the Clients page
 * search box finds "Ștefan" for a typed "stefan" too.
 */
export function matchesClient(client: Client, query: string): boolean {
  return matchesQuery(
    query,
    clientName(client),
    client.email,
    client.phone,
    client.address,
    client.type === 'company' ? client.CUI : client.CNP,
  );
}

function clientMeta(client: Client): string {
  const parts =
    client.type === 'company'
      ? [client.CUI ? `CUI ${client.CUI}` : null, client.adminName]
      : [client.CNP ? `CNP ${client.CNP}` : null];
  return [...parts, client.phone, client.email].filter(Boolean).join(' · ');
}

const MAX_RESULTS = 50;

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
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = 'client-picker-list';

  const matches = useMemo<{ client: Client; ranges: MatchRange[] }[]>(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // No query: recency ordering only, so "the client I was just on" is first.
      return [...clients]
        .sort(
          (left, right) =>
            boost('client', right.id) - boost('client', left.id) ||
            clientName(left).localeCompare(clientName(right), 'ro'),
        )
        .slice(0, MAX_RESULTS)
        .map((client) => ({ client, ranges: [] as MatchRange[] }));
    }

    return rankBy(
      clients,
      trimmed,
      (client) => [
        clientName(client),
        client.type === 'company' ? client.CUI : client.CNP,
        client.phone,
        client.email,
        client.address,
      ],
      { boost: (client) => boost('client', client.id), limit: MAX_RESULTS },
    ).map(({ item, ranges }) => ({ client: item, ranges }));
  }, [clients, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const pick = (client: Client) => {
    recordUse('client', client.id);
    onSelect(client);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (matches.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => (current + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => (current - 1 + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const match = matches[highlight];
      if (match) pick(match.client);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlight(matches.length - 1);
    } else if (event.key === 'Escape' && query) {
      // Clear the filter first; a second Escape closes the drawer.
      event.stopPropagation();
      setQuery('');
    }
  };

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
      <div onKeyDown={onKeyDown}>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Caută client (nume, CUI, email, telefon) — ↑↓ și Enter"
          width="w-full"
          controls={listId}
          activeDescendant={matches[highlight] ? `${listId}-${highlight}` : undefined}
        />
      </div>
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Clienți"
        className={cx(
          'max-h-56 overflow-y-auto rounded-md border',
          error ? 'border-red-400' : 'border-border',
        )}
      >
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : matches.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-muted">Nu s-au găsit clienți.</p>
        ) : (
          matches.map(({ client, ranges }, index) => (
            <div
              key={client.id}
              id={`${listId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === highlight}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(client)}
              className={cx(
                'flex w-full cursor-pointer flex-col items-start border-b border-border/60 px-3 py-1.5 text-left last:border-b-0',
                index === highlight ? 'bg-brand-50' : 'hover:bg-surface-sunken',
              )}
            >
              <span className={cx('text-sm', index === highlight ? 'text-brand-700' : 'text-ink')}>
                {splitHighlight(clientName(client), ranges).map((part, partIndex) =>
                  part.hit ? (
                    <mark key={partIndex} className="bg-transparent font-semibold text-brand-700">
                      {part.text}
                    </mark>
                  ) : (
                    <span key={partIndex}>{part.text}</span>
                  ),
                )}{' '}
                <span className="text-xs text-ink-subtle">
                  {client.type === 'company' ? 'PJ' : 'PF'}
                </span>
              </span>
              <span className="text-xs text-ink-muted">{clientMeta(client) || '—'}</span>
            </div>
          ))
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
