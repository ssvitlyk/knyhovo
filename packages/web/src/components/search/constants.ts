import type { SearchSort } from '@/lib/api/search';

export type { SearchSort };

/**
 * Search Results sort — UI labels and option order for the `SearchSort` union
 * (frozen Search Results v1.0 + search-sort PRD). The union itself lives in
 * `lib/api/search.ts` (single source of truth, shared with the API call).
 */
export const DEFAULT_SEARCH_SORT: SearchSort = 'price_asc';

export const SEARCH_SORT_OPTIONS: readonly SearchSort[] = ['price_asc', 'popular', 'newest'];

export const SEARCH_SORT_LABELS: Readonly<Record<SearchSort, string>> = {
  price_asc: 'Найдешевші спочатку',
  popular: 'Найпопулярніші',
  newest: 'Новинки',
};

/** Validate a raw `?sort=` value against the known options; fall back to the default. */
export function resolveSearchSort(raw: string | undefined): SearchSort {
  return (SEARCH_SORT_OPTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as SearchSort)
    : DEFAULT_SEARCH_SORT;
}

/** Popular query suggestions shown in the empty state (frozen copy). */
export const POPULAR_QUERIES: readonly string[] = [
  'Атомні звички',
  'Сергій Жадан',
  'Sapiens',
  'Гаррі Поттер',
  'Кафка на пляжі',
];

/** Number of skeleton cards shown while loading (frozen: min(perPage, 8)). */
export const SKELETON_CARD_COUNT = 8;
