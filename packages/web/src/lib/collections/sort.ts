import type { CollectionDto, CollectionsApiSort } from '@/lib/api/types';

/**
 * Sort configuration for the Collection Details template — ported 1:1 from
 * `SORT_CONFIG`/`SORT_LABELS` in the frozen `collection-details-app.jsx`.
 * The URL carries the UI sort id; the API call uses the mapped API sort
 * (`popular` → `relevance`, the rest map to themselves).
 */

export type UiSort = 'popular' | 'newest' | 'oldest' | 'price_asc' | 'price_desc';

export type CollectionKind = 'deal' | 'fresh' | '_default';

export const SORT_LABELS: Readonly<Record<UiSort, string>> = {
  popular: 'За популярністю',
  newest: 'Від нових до старих',
  oldest: 'Від старих до нових',
  price_asc: 'За зростанням ціни',
  price_desc: 'За спаданням ціни',
};

export interface SortConfig {
  readonly default: UiSort;
  readonly options: readonly UiSort[];
}

export const SORT_CONFIG: Readonly<Record<CollectionKind, SortConfig>> = {
  deal: { default: 'popular', options: ['popular', 'price_asc', 'price_desc', 'newest'] },
  fresh: {
    default: 'newest',
    options: ['newest', 'oldest', 'popular', 'price_asc', 'price_desc'],
  },
  _default: { default: 'popular', options: ['popular', 'newest', 'price_asc', 'price_desc'] },
};

/**
 * Kind of a collection for the sort dropdown. The API contract exposes no
 * dynamic config on the Collection DTO, so the canonical slugs are the
 * discriminator: znyzhky (discounts algorithm) → deal, novynky (new
 * algorithm) → fresh, anything else → _default.
 */
export function kindFor(collection: Pick<CollectionDto, 'slug'>): CollectionKind {
  if (collection.slug === 'znyzhky') return 'deal';
  if (collection.slug === 'novynky') return 'fresh';
  return '_default';
}

export function sortConfigFor(kind: CollectionKind): SortConfig {
  return SORT_CONFIG[kind];
}

/** Validate a raw `?sort=` value against the kind's options; fall back to the default. */
export function resolveUiSort(kind: CollectionKind, raw: string | undefined): UiSort {
  const cfg = sortConfigFor(kind);
  return cfg.options.includes(raw as UiSort) ? (raw as UiSort) : cfg.default;
}

/** UI sort id → API sort value (`popular` → `relevance`, the rest are same-named). */
export function toApiSort(sort: UiSort): CollectionsApiSort {
  return sort === 'popular' ? 'relevance' : sort;
}
