import type { ProviderName, Availability } from '@knyhovo/shared';
import type { BookListingRow, BookDetailsRow } from './repository.js';
import type { BookProviderDto, BookDetailsDto, MoneyDto } from './dto.js';
import { selectDescription } from '../discovery/description-selection.js';
import { selectCoverUrl } from '../discovery/cover-selection.js';
import { selectBookMetadata } from '../discovery/metadata-selection.js';
import { canonicalPriceAmount } from '../pricing/canonical-price.js';

/** Reverse map from the persisted provider enum to its public slug. */
const PROVIDER_SLUG: Record<BookListingRow['provider'], ProviderName> = {
  YAKABOO: 'yakaboo',
  BOOK_CLUB: 'book-club',
  VIVAT: 'vivat',
  BOOK_YE: 'book-ye',
  BOOKCHEF: 'bookchef',
  LABORATORY: 'laboratory',
  KNIGOLAND: 'knigoland',
  MEGAKNIGA: 'megakniga',
};

/** Reverse map from the persisted availability enum to its public slug. */
const AVAILABILITY_SLUG: Record<BookListingRow['availability'], Availability> = {
  IN_STOCK: 'in-stock',
  OUT_OF_STOCK: 'out-of-stock',
  UNKNOWN: 'unknown',
};

/** A listing counts as priced only when it carries a usable numeric amount. */
function hasPrice(listing: BookListingRow): boolean {
  return listing.priceAmount != null && Number.isFinite(listing.priceAmount);
}

/**
 * Map a canonical book row to a book details DTO.
 *
 * - Listings without a usable price are ignored (defensive — the DB column is
 *   non-null, but the contract requires skipping null prices).
 * - `providers` / `offersCount` are the offers we are willing to SHOW: everything
 *   except OUT_OF_STOCK (UNKNOWN included), sorted by ascending price.
 * - `lowestPrice` is the **canonical price** (notifications-model-v2 §4): the
 *   cheapest strictly-IN_STOCK offer, the same number the alert engine compares
 *   against. It is not always `providers[0].price`.
 * - Unlike the search mapper, this function NEVER returns null — the book
 *   record itself is always returned, even when all its listings are
 *   out-of-stock or absent (`providers: [], lowestPrice: null, offersCount: 0`).
 *   This allows the UI to display the book detail page with an "unavailable"
 *   state rather than a 404.
 */
export function toBookDetails(row: BookDetailsRow): BookDetailsDto {
  const providers: BookProviderDto[] = row.listings
    .filter(hasPrice)
    .filter((l) => l.availability !== 'OUT_OF_STOCK')
    .map((l) => ({
      provider: PROVIDER_SLUG[l.provider],
      price: { amount: l.priceAmount, currency: l.priceCurrency } satisfies MoneyDto,
      availability: AVAILABILITY_SLUG[l.availability],
      url: l.url,
      lastSeenAt: l.lastSeenAt.toISOString(),
    }))
    .sort((a, b) => a.price.amount - b.price.amount);

  const canonicalAmount = canonicalPriceAmount(row.listings);
  const lowestPrice: MoneyDto | null =
    canonicalAmount === null
      ? null
      : { amount: canonicalAmount, currency: providers[0]?.price.currency ?? 'UAH' };
  const offersCount = providers.length;

  // Description and cover are selected across ALL listings (in-stock and
  // out-of-stock alike, W9a §8/§9) by provider priority with an
  // ascending-price tiebreak — independent of the in-stock `providers`
  // filtering above.
  const description = selectDescription(
    row.listings.map((l) => ({
      provider: PROVIDER_SLUG[l.provider],
      description: l.description,
      priceAmount: l.priceAmount,
    })),
  );
  const coverUrl = selectCoverUrl(
    row.listings.map((l) => ({
      provider: PROVIDER_SLUG[l.provider],
      coverUrl: l.coverUrl,
      priceAmount: l.priceAmount,
    })),
  );

  // Edition metadata (book-metadata PRD) — same all-listings, provider-priority
  // selection as description/cover, each field chosen independently.
  const metadata = selectBookMetadata(
    row.listings.map((l) => ({
      provider: PROVIDER_SLUG[l.provider],
      priceAmount: l.priceAmount,
      publisher: l.publisher,
      language: l.language,
      format: l.format,
      series: l.series,
      publicationYear: l.publicationYear,
    })),
  );

  // The canonical ISBN wins; when enrichment has only backfilled listing-level
  // ISBNs (the canonical row is created before product-page enrichment runs),
  // fall back to the cheapest listing that carries one.
  const isbn = row.isbn ?? row.listings.find((l) => l.isbn)?.isbn ?? null;

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    isbn,
    description,
    coverUrl,
    publisher: metadata.publisher,
    language: metadata.language,
    format: metadata.format,
    series: metadata.series,
    publicationYear: metadata.publicationYear,
    lowestPrice,
    offersCount,
    providers,
  };
}
