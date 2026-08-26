/**
 * "What this operator actually touches" — a local usage log used to rank
 * search results and pickers.
 *
 * Purely client-side and per-browser: every entry is written here when the
 * user opens or picks a record, and read back as a ranking bonus. Nothing is
 * sent anywhere, and a cleared localStorage only costs the ranking bonus —
 * every list still works, just alphabetically fair instead of personalised.
 *
 * The score is frequency with an exponential recency decay (half-life two
 * weeks), so yesterday's five clients beat a record opened forty times last
 * quarter. Callers add `boost(...)` to a match score; the ceiling is bounded
 * (BOOST_CEILING) so recency nudges ambiguous queries without ever letting a
 * stale favourite outrank an exact-name hit.
 */

const STORAGE_KEY = 'ecotrack:recents:v1';
const MAX_ENTRIES = 240;
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
const BOOST_CEILING = 260;

export type RecentKind =
  | 'client'
  | 'order'
  | 'task'
  | 'route'
  | 'product'
  | 'recurring'
  | 'driver'
  | 'command';

interface Entry {
  /** `${kind}:${id}` */
  key: string;
  count: number;
  /** Epoch ms of the last use. */
  last: number;
}

let entries: Entry[] = [];
let loaded = false;
const listeners = new Set<() => void>();
/** Bumped on every write so `useSyncExternalStore` sees a new snapshot. */
let revision = 0;

function entryKey(kind: RecentKind, id: string | number): string {
  return `${kind}:${id}`;
}

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    entries = parsed.filter(
      (item): item is Entry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Entry).key === 'string' &&
        typeof (item as Entry).count === 'number' &&
        typeof (item as Entry).last === 'number',
    );
  } catch {
    // Private mode, quota, or a corrupt value — ranking simply falls back to
    // plain relevance. Never worth breaking a screen over.
    entries = [];
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore: the in-memory log still ranks this session.
  }
}

/** Records one use. Call it when the user *acts* on a record, not on hover. */
export function recordUse(kind: RecentKind, id: string | number): void {
  load();
  const key = entryKey(kind, id);
  const now = Date.now();
  const existing = entries.find((entry) => entry.key === key);

  if (existing) {
    existing.count += 1;
    existing.last = now;
  } else {
    entries.push({ key, count: 1, last: now });
  }

  if (entries.length > MAX_ENTRIES) {
    entries.sort((left, right) => right.last - left.last);
    entries = entries.slice(0, MAX_ENTRIES);
  }

  revision += 1;
  persist();
  for (const listener of listeners) listener();
}

function decayed(entry: Entry, now: number): number {
  const age = Math.max(0, now - entry.last);
  return entry.count * Math.pow(0.5, age / HALF_LIFE_MS);
}

/** Ranking bonus for one record, 0 when it has never been used. */
export function boost(kind: RecentKind, id: string | number): number {
  load();
  const entry = entries.find((item) => item.key === entryKey(kind, id));
  if (!entry) return 0;
  const weight = decayed(entry, Date.now());
  // log1p keeps the first few uses meaningful and flattens the tail.
  return Math.min(BOOST_CEILING, Math.log1p(weight) * 95);
}

/** Ids of the most recently used records of one kind, newest first. */
export function recentIds(kind: RecentKind, limit = 8): string[] {
  load();
  const prefix = `${kind}:`;
  return entries
    .filter((entry) => entry.key.startsWith(prefix))
    .sort((left, right) => right.last - left.last)
    .slice(0, limit)
    .map((entry) => entry.key.slice(prefix.length));
}

export function subscribeRecents(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot token for `useSyncExternalStore` — changes on every write. */
export function recentsRevision(): number {
  load();
  return revision;
}
