import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { clientSearch } from '@/lib/api/searchClient';
import type { SearchItemDto, SearchResponseDto } from '@/lib/api/types';
import { SEARCH_DEBOUNCE_MS, SEARCH_SUGGESTIONS_LIMIT } from '@/lib/search/config';
import { clearSuggestionsCache, useSuggestions } from '../useSuggestions';

const SUGGEST_DEBOUNCE_MS = SEARCH_DEBOUNCE_MS;
const SUGGEST_LIMIT = SEARCH_SUGGESTIONS_LIMIT;

vi.mock('@/lib/api/searchClient', () => ({ clientSearch: vi.fn() }));

const mockClientSearch = vi.mocked(clientSearch);

function item(id: string, title: string): SearchItemDto {
  return {
    id,
    title,
    author: 'Автор',
    lowestPrice: { amount: 24900, currency: 'UAH' },
    offersCount: 1,
    providers: [{ provider: 'yakaboo', price: { amount: 24900, currency: 'UAH' } }],
    coverUrl: null,
  };
}

function response(items: readonly SearchItemDto[]): SearchResponseDto {
  return { items, page: 1, pageSize: SUGGEST_LIMIT, totalItems: items.length, totalPages: 1 };
}

/** Advance past the debounce and let the resulting promise chain settle. */
async function settle(ms: number = SUGGEST_DEBOUNCE_MS): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useSuggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearSuggestionsCache();
    mockClientSearch.mockReset();
    mockClientSearch.mockResolvedValue(response([item('b1', 'Кобзар')]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call the API below the minimum query length', async () => {
    const { rerender } = renderHook(({ v }) => useSuggestions(v), { initialProps: { v: '' } });

    rerender({ v: 'К' });
    await settle(1000);

    expect(mockClientSearch).not.toHaveBeenCalled();
  });

  it('reports not-enabled and no loading state below the minimum length', async () => {
    const { result, rerender } = renderHook(({ v }) => useSuggestions(v), {
      initialProps: { v: '' },
    });

    rerender({ v: 'К' });
    await settle(1000);

    expect(result.current.enabled).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.settled).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('fetches after the debounce once the query reaches two characters', async () => {
    const { result, rerender } = renderHook(({ v }) => useSuggestions(v), {
      initialProps: { v: '' },
    });

    rerender({ v: 'Ко' });
    expect(result.current.loading).toBe(true);
    expect(mockClientSearch).not.toHaveBeenCalled();

    await settle(SUGGEST_DEBOUNCE_MS - 1);
    expect(mockClientSearch).not.toHaveBeenCalled();

    await settle(1);
    expect(mockClientSearch).toHaveBeenCalledTimes(1);
    expect(mockClientSearch.mock.calls[0][0]).toMatchObject({ q: 'Ко', pageSize: SUGGEST_LIMIT });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.settled).toBe(true);
  });

  it('issues only the final request while typing quickly', async () => {
    const { rerender } = renderHook(({ v }) => useSuggestions(v), { initialProps: { v: '' } });

    rerender({ v: 'Ко' });
    await settle(100);
    rerender({ v: 'Коб' });
    await settle(100);
    rerender({ v: 'Кобз' });
    await settle(100);
    rerender({ v: 'Кобзар' });
    await settle(SUGGEST_DEBOUNCE_MS);

    expect(mockClientSearch).toHaveBeenCalledTimes(1);
    expect(mockClientSearch.mock.calls[0][0].q).toBe('Кобзар');
  });

  it('does not re-request when only surrounding whitespace changes', async () => {
    const { rerender } = renderHook(({ v }) => useSuggestions(v), { initialProps: { v: '' } });

    rerender({ v: 'Ко' });
    await settle();
    expect(mockClientSearch).toHaveBeenCalledTimes(1);

    rerender({ v: '  Ко  ' });
    await settle(1000);

    expect(mockClientSearch).toHaveBeenCalledTimes(1);
  });

  it('aborts the in-flight request when the query changes', async () => {
    const signals: AbortSignal[] = [];
    mockClientSearch.mockImplementation((args) => {
      if (args.signal) signals.push(args.signal);
      return new Promise<SearchResponseDto>(() => {
        /* never settles */
      });
    });

    const { rerender } = renderHook(({ v }) => useSuggestions(v), { initialProps: { v: '' } });

    rerender({ v: 'Ко' });
    await settle();
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    rerender({ v: 'Кобзар' });
    await settle();

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('never lets a stale response overwrite the newer query results', async () => {
    let resolveFirst: (r: SearchResponseDto) => void = () => undefined;
    mockClientSearch.mockImplementationOnce(
      () =>
        new Promise<SearchResponseDto>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockClientSearch.mockResolvedValueOnce(response([item('b2', 'Новий запит')]));

    const { result, rerender } = renderHook(({ v }) => useSuggestions(v), {
      initialProps: { v: '' },
    });

    rerender({ v: 'Ко' });
    await settle();
    rerender({ v: 'Кобзар' });
    await settle();

    expect(result.current.items.map((i) => i.id)).toEqual(['b2']);

    // The first (aborted) request resolves late — it must be ignored.
    await act(async () => {
      resolveFirst(response([item('b1', 'Старий запит')]));
    });

    expect(result.current.items.map((i) => i.id)).toEqual(['b2']);
  });

  it('resets to a disabled empty state when the input is cleared', async () => {
    const { result, rerender } = renderHook(({ v }) => useSuggestions(v), {
      initialProps: { v: '' },
    });

    rerender({ v: 'Кобзар' });
    await settle();
    expect(result.current.items).toHaveLength(1);

    rerender({ v: '' });
    await settle(1000);

    expect(result.current.enabled).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockClientSearch).toHaveBeenCalledTimes(1);
  });

  it('serves a repeated query from the client cache without a new request', async () => {
    const { rerender } = renderHook(({ v }) => useSuggestions(v), { initialProps: { v: '' } });

    rerender({ v: 'Кобзар' });
    await settle();
    expect(mockClientSearch).toHaveBeenCalledTimes(1);

    rerender({ v: 'Кобзарі' });
    await settle();
    expect(mockClientSearch).toHaveBeenCalledTimes(2);

    rerender({ v: 'Кобзар' });
    await settle(1000);

    expect(mockClientSearch).toHaveBeenCalledTimes(2);
  });

  it('degrades softly on failure and does not cache the error', async () => {
    mockClientSearch.mockRejectedValueOnce(new Error('boom'));

    const { result, rerender } = renderHook(({ v }) => useSuggestions(v), {
      initialProps: { v: '' },
    });

    rerender({ v: 'Кобзар' });
    await settle();

    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.settled).toBe(true);
    expect(result.current.items).toEqual([]);

    mockClientSearch.mockResolvedValueOnce(response([item('b1', 'Кобзар')]));
    await act(async () => {
      result.current.retry();
    });
    await settle();

    expect(result.current.error).toBe(false);
    expect(result.current.items).toHaveLength(1);
  });

  it('does not surface an abort as a user-facing error', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    mockClientSearch.mockRejectedValueOnce(abortError);

    const { result, rerender } = renderHook(({ v }) => useSuggestions(v), {
      initialProps: { v: '' },
    });

    rerender({ v: 'Кобзар' });
    await settle();

    expect(result.current.error).toBe(false);
  });
});
