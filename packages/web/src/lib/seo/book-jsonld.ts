import type { Availability } from '@knyhovo/shared';
import type { BookDetailsDto } from '@/lib/api/types';

/**
 * SEO helpers for the Book Details page. Pure functions over the existing
 * `BookDetailsDto` contract — no backend, schema, or API changes. Used by
 * `generateMetadata` (description) and the inline JSON-LD `<script>` (schema.org
 * `Book` + `AggregateOffer`). All money arrives in kopiyky and is converted to
 * major units for structured data (matching how `formatMoney` renders prices).
 */

const META_DESCRIPTION_MAX = 155;

/** Convert an integer kopiyky amount to major currency units (e.g. 34900 → 349). */
function toMajorUnits(amount: number): number {
  return Number((amount / 100).toFixed(2));
}

/** Map the internal availability to a schema.org availability URL. */
function schemaAvailability(availability: Availability): string {
  switch (availability) {
    case 'in-stock':
      return 'https://schema.org/InStock';
    case 'out-of-stock':
      return 'https://schema.org/OutOfStock';
    case 'unknown':
      return 'https://schema.org/LimitedAvailability';
  }
}

/**
 * Build the meta description for a book. Uses the (whitespace-collapsed,
 * truncated) description when present; otherwise a deterministic price-compare
 * fallback so every book page has a unique, non-empty description.
 */
export function buildBookMetaDescription(book: BookDetailsDto): string {
  if (book.description) {
    const clean = book.description.replace(/\s+/g, ' ').trim();
    if (clean.length <= META_DESCRIPTION_MAX) return clean;
    return `${clean.slice(0, META_DESCRIPTION_MAX - 1).trimEnd()}…`;
  }
  return `Порівняйте ціни на «${book.title}» (${book.author}) у книгарнях України — Knyhovo.`;
}

/**
 * Build a schema.org `Book` JSON-LD object. Optional fields (isbn, image,
 * description, offers) are omitted when the API has no data — the page never
 * breaks on partial data. When at least one provider offer exists, an
 * `AggregateOffer` with per-provider `Offer` entries is included.
 */
export function buildBookJsonLd(book: BookDetailsDto, siteUrl: string): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: book.author },
    url: `${siteUrl}/books/${book.id}`,
  };

  if (book.isbn) jsonLd.isbn = book.isbn;
  if (book.coverUrl) jsonLd.image = book.coverUrl;
  if (book.description) jsonLd.description = book.description;

  if (book.providers.length > 0) {
    const amounts = book.providers.map((p) => p.price.amount);
    const currency = book.lowestPrice?.currency ?? book.providers[0]!.price.currency;
    const lowAmount = book.lowestPrice?.amount ?? Math.min(...amounts);
    const highAmount = Math.max(...amounts);

    jsonLd.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: currency,
      lowPrice: toMajorUnits(lowAmount),
      highPrice: toMajorUnits(highAmount),
      offerCount: book.offersCount,
      offers: book.providers.map((p) => ({
        '@type': 'Offer',
        price: toMajorUnits(p.price.amount),
        priceCurrency: p.price.currency,
        availability: schemaAvailability(p.availability),
        url: p.url,
      })),
    };
  }

  return jsonLd;
}
