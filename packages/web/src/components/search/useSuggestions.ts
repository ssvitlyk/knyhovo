'use client';

import { useCallback, useEffect, useState } from 'react';

import { clientSearch } from '@/lib/api/searchClient';
import type { SearchItemDto } from '@/lib/api/types';
import { useDebouncedValue } from './useDebouncedValue';

/** Minimum number of normalized characters before any request is issued. */
export const SUGGEST_MIN_LENGTH = 2;
/** Debounce applied to the normalized query before fetching. */
export const SUGGEST_DEBOUNCE_MS = 300;
/** Autocomplete fan-out — short list, never a full results page. */
export const SUGGEST_LIMIT = 8;

/** Upper bound on the client-side cache so a long session cannot grow it forever. */
const CACHE_MAX_ENTRIES = 30;

/**
 * Normalize a raw input value into the cache/request key: leading and trailing
 * whitespace is dropped and inner runs collapse to a single space, so `"ab "`,
 * `" ab"` and `"ab"` are the same query and never cause an extra request.
 */
export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Successful responses only, keyed by normalized query. Module-level so the
 * desktop capsule and the mobile overlay share it and a remount keeps warm
 * results. Errors are never cached (a retry must hit the network again).
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
 * Debounced, abortable, cached autocomplete for a search field.
 *
 * Async state is stored keyed by the query it belongs to and `loading` / `error`
 * / `items` are DERIVED during render, so a late response for an older query can
 * never be shown for a newer one; the in-flight request is additionally aborted
 * whenever the debounced query changes. Aborts are not surfaced as errors.
 */
export function useSuggestions(rawValue: string, limit: number = SUGGEST_LIMIT): SuggestionsState {
  const query = normalizeQuery(rawValue);
  const enabled = query.length >= SUGGEST_MIN_LENGTH;

  const debouncedQuery = useDebouncedValue(query, SUGGEST_DEBOUNCE_MS);

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
    if (normalizeQuery(debouncedQuery).length < SUGGEST_MIN_LENGTH) return undefined;
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
  }, [debouncedQuery, limit, retryKey]);

  const retry = useCallback((): void => {
    setErrorQuery(null);
    setRetryKey((k) => k + 1);
  }, []);

  return { query, enabled, items, loading, error, settled: ready || error, retry };
}
