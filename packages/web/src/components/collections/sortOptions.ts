/**
 * Collection sort options — a plain (non-client) module so both the Server
 * Component page and the `'use client'` SortDropdown can import the runtime
 * values. Runtime value exports from a `'use client'` module become client
 * reference stubs when imported into a Server Component, so these must NOT live
 * in SortDropdown.tsx.
 */
export type CollectionSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'discount_desc';

export const SORT_OPTIONS: readonly CollectionSort[] = [
  'relevance',
  'price_asc',
  'price_desc',
  'newest',
  'discount_desc',
];

export const SORT_LABELS: Readonly<Record<CollectionSort, string>> = {
  relevance: 'За релевантністю',
  price_asc: 'За зростанням ціни',
  price_desc: 'За спаданням ціни',
  newest: 'Від нових до старих',
  discount_desc: 'За розміром знижки',
};
