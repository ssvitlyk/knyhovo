'use client';

import { useCallback, useEffect, useState } from 'react';

import { clientSearch } from '@/lib/api/searchClient';
import type { SearchItemDto } from '@/lib/api/types';
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_QUERY_LENGTH,
  SEARCH_SUGGESTIONS_LIMIT,
} from '@/lib/search/config';
import { normalizeSearchInput } from '@/lib/search/normalize';
import { useDebouncedValue } from './useDebouncedValue';

/** Upper bound on the client-side cache so a long session cannot grow it forever. */
const CACHE_MAX_ENTRIES = 30;

/**
 * Successful responses only, keyed by normalized query. Module-level so every
 * surface (header capsule, mobile overlay, hero, `/search` typeahead) shares it
 * and a remount keeps warm results. Errors are never cached (a retry must hit
 * the network again).
 */
const cache = new Map<string, readonly SearchItemDto[]>();

/** Test seam — drops the shared suggestion cache. */
export function clearSuggestionsCache(): void {
  cache.clear();
}

function readCache(query: string): readonly SearchItemDto[] | undefined {
  return cache.get(query);
}

function writeCache(query: string, items: readonly SearchItemDto[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(query, items);
}

/** View-state of the autocomplete for the value currently typed in the field. */
export interface SuggestionsState {
  /** Normalized query the state below belongs to. */
  readonly query: string;
  /** Whether the normalized query is long enough to be searched at all. */
  readonly enabled: boolean;
  readonly items: readonly SearchItemDto[];
  readonly loading: boolean;
  readonly error: boolean;
  /** True once the current query has a settled outcome (results or error). */
  readonly settled: boolean;
  /** Re-fetch the current query, bypassing a cached failure. */
  readonly retry: () => void;
}

/**
 * Debounced, abortable, cached autocomplete for a search field — the single
 * data engine behind every search surface in the app.
 *
 * Async state is stored keyed by the query it belongs to and `loading` / `error`
 * / `items` are DERIVED during render, so a late response for an older query can
 * never be shown for a newer one; the in-flight request is additionally aborted
 * whenever the debounced query changes. Aborts are not surfaced as errors.
 *
 * `active` is the "the user is actually using this field" gate: `/search`
 * mounts its typeahead pre-filled from `?q=`, and suggestions for that query
 * would duplicate the results the page already rendered server-side. Nothing is
 * fetched until the field is focused or edited.
 */
export function useSuggestions(
  rawValue: string,
  limit: number = SEARCH_SUGGESTIONS_LIMIT,
  active: boolean = true,
): SuggestionsState {
  const query = normalizeSearchInput(rawValue);
  const enabled = active && query.length >= SEARCH_MIN_QUERY_LENGTH;

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const [result, setResult] = useState<{
    readonly query: string;
    readonly items: readonly SearchItemDto[];
  } | null>(null);
  const [errorQuery, setErrorQuery] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // A cache hit for a query typed again is applied synchronously below, so the
  // dropdown can reopen on focus without a network round-trip.
  const cached = enabled ? readCache(query) : undefined;
  const settledResult = cached !== undefined ? { query, items: cached } : result;

  const ready = settledResult !== null && settledResult.query === query;
  const error = enabled && !ready && errorQuery === query;
  const loading = enabled && !ready && !error;
  const items = ready ? settledResult.items : [];

  useEffect(() => {
    if (!active) return undefined;
    if (normalizeSearchInput(debouncedQuery).length < SEARCH_MIN_QUERY_LENGTH) return undefined;
    if (readCache(debouncedQuery) !== undefined) return undefined;

    const controller = new AbortController();

    void clientSearch({ q: debouncedQuery, signal: controller.signal, pageSize: limit })
      .then((res) => {
        // Guard as well as abort: a response that lost the race must never
        // overwrite the state of a newer query.
        if (controller.signal.aborted) return;
        writeCache(debouncedQuery, res.items);
        setResult({ query: debouncedQuery, items: res.items });
        setErrorQuery((prev) => (prev === debouncedQuery ? null : prev));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err as Error).name === 'AbortError') return;
        setErrorQuery(debouncedQuery);
      });

    return () => {
      controller.abort();
    };
  }, [active, debouncedQuery, limit, retryKey]);

  const retry = useCallback((): void => {
    setErrorQuery(null);
    setRetryKey((k) => k + 1);
  }, []);

  return { query, enabled, items, loading, error, settled: ready || error, retry };
}
