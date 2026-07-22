/**
 * Homepage v1.0 — shared shelf types + hero search chips.
 *
 * The discovery shelves («Популярне зараз» / «Новинки» / «Книговик радить»)
 * are now fed by the single composed `GET /api/home` endpoint — see `./data.ts`
 * for the fetch + mapping (`getHomeShelves`). This module keeps only the shared `HomeBook` /
 * `HomeBadge` types the shelf components render, plus the hero's static
 * popular-query chips (legit curated content, not book data).
 */

/**
 * Badge spec on a shelf book. Frozen BookCard hierarchy, max one per card:
 * `green` → «Найкраща ціна», `solid:-N%` → discount, `accent:Новинка` → new.
 */
export type HomeBadge = 'green' | `solid:${string}` | `accent:${string}`;

export interface HomeBook {
  readonly id: string;
  /** Site-relative Book Details URL (e.g. `/books/:id`). */
  readonly href: string;
  readonly title: string;
  readonly author: string;
  /** Pre-formatted price string, e.g. `"245 ₴"`. */
  readonly price: string;
  /** Pre-formatted old price (strikethrough) when discounted. */
  readonly oldPrice?: string | null;
  /** Store / provider display name (muted tertiary slot). */
  readonly store?: string | null;
  /** Cover image path under `public/`. */
  readonly cover?: string | null;
  readonly badge?: HomeBadge | null;
  /** Number of provider offers; when > 1 the card shows a muted "ще N" note. */
  readonly offersCount?: number;
}

/** Hero popular-query chips → each navigates to `/search?q=…`. */
export const POPULAR_QUERIES: readonly string[] = [
  'Атомні звички',
  'Жадан',
  'Sapiens',
  'Кідрук',
  'Харарі',
];
