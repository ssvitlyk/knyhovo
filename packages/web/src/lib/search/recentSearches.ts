import { normalizeQuery } from './normalize';

/** localStorage key for the recent-searches list. */
export const RECENT_SEARCHES_KEY = 'kn-recent-searches';

/** Maximum number of recent search entries to retain. */
export const RECENT_SEARCHES_LIMIT = 8;

/** Stable empty snapshot (referential stability for `useSyncExternalStore`). */
const EMPTY: readonly string[] = Object.freeze([]);

/** Subscribers notified after any same-tab mutation. */
const listeners = new Set<() => void>();

/** Cached snapshot, kept referentially stable while the stored raw value is unchanged. */
let cachedRaw: string | null = null;
let cachedList: readonly string[] = EMPTY;

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * `useSyncExternalStore` subscribe: same-tab mutations (via {@link notify}) and
 * cross-tab `storage` events. Returns an unsubscribe function.
 */
export function subscribeRecentSearches(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === RECENT_SEARCHES_KEY || e.key === null) listener();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/**
 * `useSyncExternalStore` getSnapshot: returns the current list with a STABLE
 * reference while the underlying localStorage value is unchanged (required to
 * avoid render loops). Returns the frozen empty array on the server.
 */
export function getRecentSearchesSnapshot(): readonly string[] {
  if (typeof window === 'undefined') return EMPTY;
  let raw: string | null;
  try {
    raw = localStorage.getItem(RECENT_SEARCHES_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  cachedList = raw === null ? EMPTY : getRecentSearches();
  return cachedList;
}

/** Server snapshot for `useSyncExternalStore` — always the stable empty array. */
export function getRecentSearchesServerSnapshot(): readonly string[] {
  return EMPTY;
}

/**
 * Read the current recent-searches list from localStorage.
 *
 * SSR-safe: returns `[]` when `window` is not defined.
 * Returns `[]` on any parse error or when the stored value is not an array.
 * Non-string elements are filtered out.
 */
export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/**
 * Add a query to the top of the recent-searches list and persist it.
 *
 * - Trims the query; ignores empty strings.
 * - Removes any existing entry that matches case-insensitively (via `normalizeQuery`).
 * - Prepends the trimmed original-cased query.
 * - Caps the list at {@link RECENT_SEARCHES_LIMIT}.
 *
 * SSR-safe: no-ops and returns `[]` when `window` is not defined.
 * Returns the updated list.
 */
export function addRecentSearch(query: string): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const trimmed = query.trim();
  if (trimmed === '') {
    return getRecentSearches();
  }

  const normalizedNew = normalizeQuery(trimmed);
  const existing = getRecentSearches();
  const deduped = existing.filter((entry) => normalizeQuery(entry) !== normalizedNew);
  const updated = [trimmed, ...deduped].slice(0, RECENT_SEARCHES_LIMIT);

  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    notify();
  } catch {
    // Quota exceeded or storage unavailable — return what we computed anyway.
  }

  return updated;
}

/**
 * Remove all entries matching the given query case-insensitively.
 *
 * SSR-safe: returns `[]` when `window` is not defined.
 * Returns the updated list.
 */
export function removeRecentSearch(query: string): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const normalizedTarget = normalizeQuery(query);
  const existing = getRecentSearches();
  const updated = existing.filter((entry) => normalizeQuery(entry) !== normalizedTarget);

  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    notify();
  } catch {
    // Quota exceeded or storage unavailable.
  }

  return updated;
}

/**
 * Clear all recent searches by removing the localStorage key.
 *
 * SSR-safe: no-ops when `window` is not defined.
 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    notify();
  } catch {
    // Storage unavailable.
  }
}
