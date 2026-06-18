'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearchesServerSnapshot,
  getRecentSearchesSnapshot,
  removeRecentSearch,
  subscribeRecentSearches,
} from '@/lib/search/recentSearches';

/** Public interface returned by {@link useRecentSearches}. */
export interface UseRecentSearches {
  readonly recent: readonly string[];
  readonly add: (query: string) => void;
  readonly remove: (query: string) => void;
  readonly clear: () => void;
}

/**
 * React wrapper around the `recentSearches` lib.
 *
 * Backed by `useSyncExternalStore`: the server snapshot is the stable empty
 * array (hydration-safe), and mutations notify subscribers so the list updates
 * without a state-syncing effect.
 */
export function useRecentSearches(): UseRecentSearches {
  const recent = useSyncExternalStore(
    subscribeRecentSearches,
    getRecentSearchesSnapshot,
    getRecentSearchesServerSnapshot,
  );

  const add = useCallback((query: string): void => {
    addRecentSearch(query);
  }, []);

  const remove = useCallback((query: string): void => {
    removeRecentSearch(query);
  }, []);

  const clear = useCallback((): void => {
    clearRecentSearches();
  }, []);

  return { recent, add, remove, clear };
}
