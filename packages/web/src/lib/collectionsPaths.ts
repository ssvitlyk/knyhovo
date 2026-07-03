/**
 * Centralized path builders for the Collections feature so the `/catalog`
 * base can change in one place. Genre, mood, and collection detail pages all
 * live under the single `/catalog/[slug]` route.
 */

export const CATALOG_BASE = '/catalog';

/** Path to the Collections home (catalog landing) page. */
export function catalogPath(): string {
  return CATALOG_BASE;
}

/** Path to a collection/genre/mood detail page by slug. */
export function collectionPath(slug: string): string {
  return `${CATALOG_BASE}/${slug}`;
}
