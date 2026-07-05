import type { CollectionBookDto, CollectionDto } from '@/lib/api/types';
import { knBookWord } from '@/lib/format';

/**
 * SEO helpers for the Collections pages (Collections PRD Part 09). Pure
 * functions over the existing DTO contract. JSON-LD is SSR-rendered inline;
 * the ItemList is generated for page 1 only (never for deeper pagination).
 */

const META_DESCRIPTION_MAX = 155;

/** Convert an integer kopiyky amount to major currency units (e.g. 34900 → 349). */
function toMajorUnits(amount: number): number {
  return Number((amount / 100).toFixed(2));
}

/**
 * Meta description pattern from the PRD:
 * «N книг у добірці "[Назва]". Порівняйте ціни у 5 книгарнях…» — the
 * collection's own description is appended when it fits.
 */
export function buildCollectionMetaDescription(collection: CollectionDto): string {
  const base = `${collection.bookCount} ${knBookWord(collection.bookCount)} у добірці «${collection.name}». Порівняйте ціни у книгарнях та знайдіть найкращу пропозицію.`;
  if (base.length >= META_DESCRIPTION_MAX) return `${base.slice(0, META_DESCRIPTION_MAX - 1).trimEnd()}…`;
  return base;
}

/** schema.org `BreadcrumbList` for Головна → Добірки → (name). */
export function buildBreadcrumbJsonLd(
  siteUrl: string,
  crumbs: readonly { readonly name: string; readonly path: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: `${siteUrl}${crumb.path}`,
    })),
  };
}

/** schema.org `CollectionPage` for the hub and for a collection page. */
export function buildCollectionPageJsonLd(
  siteUrl: string,
  path: string,
  name: string,
  description: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${siteUrl}${path}`,
    inLanguage: 'uk',
  };
}

/**
 * schema.org `ItemList` of the first page of books (24 max). Each ListItem
 * wraps a `Book` with name, author and a UAH offer. Only rendered for page 1.
 */
export function buildItemListJsonLd(
  siteUrl: string,
  collection: CollectionDto,
  books: readonly CollectionBookDto[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: collection.name,
    numberOfItems: collection.bookCount,
    itemListElement: books.map((book, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Book',
        name: book.title,
        author: { '@type': 'Person', name: book.author },
        url: `${siteUrl}${book.url}`,
        ...(book.minPrice !== null
          ? {
              offers: {
                '@type': 'Offer',
                price: toMajorUnits(book.minPrice.amount),
                priceCurrency: 'UAH',
              },
            }
          : {}),
      },
    })),
  };
}
