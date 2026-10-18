import type { RawProviderListing, CanonicalBook, ProviderName, Currency, Availability } from '@knyhovo/shared';
import type { CanonicalBookId } from '@knyhovo/shared';
import type { MatchResult } from '@knyhovo/scrapers';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { ListingPersistOutcome, UnavailableOutcome } from './types.js';
import { recordPriceChange } from '../price-history/service.js';
import { advanceWatermark } from './scrape-state.repository.js';
import { PROVIDER_DB_ENUM, PROVIDER_SLUG } from '../pricing/provider-maps.js';
import type { DbProvider } from '../pricing/provider-maps.js';

export function mapProviderName(name: ProviderName): DbProvider {
  return PROVIDER_DB_ENUM[name];
}

/** Inverse of {@link mapProviderName}: Prisma `Provider` enum → shared slug. */
export function unmapProviderName(provider: DbProvider): ProviderName {
  return PROVIDER_SLUG[provider];
}

const CURRENCY_MAP: Record<Currency, 'UAH'> = {
  UAH: 'UAH',
};

export function mapCurrency(c: Currency): 'UAH' {
  return CURRENCY_MAP[c];
}

const AVAILABILITY_MAP: Record<Availability, 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN'> = {
  'in-stock': 'IN_STOCK',
  'out-of-stock': 'OUT_OF_STOCK',
  unknown: 'UNKNOWN',
};

export function mapAvailability(a: Availability): 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN' {
  return AVAILABILITY_MAP[a];
}

function cleanRawCategories(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    const trimmed = entry.trim();
    if (trimmed === '' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/**
 * Advance the per-URL sitemap-lastmod watermark, but only when the listing
 * carries a `sourceLastmod` signal (`undefined` = provider has none; `null` =
 * explicitly no lastmod, which is still recorded).
 */
export async function maybeAdvanceWatermark(
  db: Prisma.TransactionClient | PrismaClient,
  listing: RawProviderListing,
  scrapedAt: Date,
): Promise<void> {
  if (listing.sourceLastmod === undefined) return;
  await advanceWatermark(db, mapProviderName(listing.provider), listing.url, listing.sourceLastmod, scrapedAt);
}

export async function persistListing(
  tx: Prisma.TransactionClient,
  ctx: { listing: RawProviderListing; result: MatchResult; scrapedAt: Date },
): Promise<ListingPersistOutcome> {
  const { listing, result, scrapedAt } = ctx;

  // Preconditions: listing.price is NOT null, result.type is NOT 'conflict'
  // These are guaranteed by the caller.

  const provider = mapProviderName(listing.provider);
  const existing = await tx.providerListing.findUnique({
    where: { provider_url: { provider, url: listing.url } },
  });

  const priceAmount = listing.price!.amount;
  const priceCurrency = mapCurrency(listing.price!.currency);
  const availability = mapAvailability(listing.availability);
  const author = listing.author ?? '';

  if (existing === null) {
    // NEW listing
    let canonicalBookId: string;
    let createdCanonical: CanonicalBook | null = null;

    if (result.type === 'matched') {
      canonicalBookId = result.canonicalBookId as string;
    } else {
      // result.type === 'created'
      const canon = await tx.canonicalBook.create({
        data: {
          title: listing.title,
          author,
          isbn: listing.isbn ?? null,
          createdAt: scrapedAt,
        },
      });
      canonicalBookId = canon.id;
      createdCanonical = {
        id: canon.id as CanonicalBookId,
        title: listing.title,
        author,
        isbn: listing.isbn ?? null,
        createdAt: canon.createdAt.toISOString(),
      };
    }

    const created = await tx.providerListing.create({
      data: {
        canonicalBookId,
        provider,
        title: listing.title,
        author,
        isbn: listing.isbn ?? null,
        priceAmount,
        priceCurrency,
        url: listing.url,
        lastSeenAt: scrapedAt,
        availability,
        coverUrl: listing.coverUrl ?? null,
        description: listing.description ?? null,
        publisher: listing.publisher ?? null,
        language: listing.language ?? null,
        format: listing.format ?? null,
        series: listing.series ?? null,
        publicationYear: listing.publicationYear ?? null,
        rawCategories: cleanRawCategories(listing.rawCategories ?? []),
      },
    });

    await recordPriceChange(tx, {
      providerListingId: created.id,
      previous: null,
      next: { priceAmount, priceCurrency, availability },
      recordedAt: scrapedAt,
    });

    await maybeAdvanceWatermark(tx, listing, scrapedAt);

    return { kind: 'listing-created', createdCanonical, canonicalBookId, priceHistoryCreated: true };
  } else {
    // EXISTING listing — do NOT change canonicalBookId
    const updateData: {
      priceAmount: number;
      priceCurrency: 'UAH';
      title: string;
      author: string;
      lastSeenAt: Date;
      availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
      isbn?: string;
      coverUrl?: string;
      description?: string;
      publisher?: string;
      language?: string;
      format?: string;
      series?: string;
      publicationYear?: number;
      rawCategories?: string[];
    } = {
      priceAmount,
      priceCurrency,
      title: listing.title,
      author,
      lastSeenAt: scrapedAt,
      availability,
    };

    if (existing.isbn === null && listing.isbn != null) {
      updateData.isbn = listing.isbn;
    }

    // Refresh the cover only when this scrape produced one — never overwrite a
    // previously-known cover with null (graceful enrichment; W9a F1).
    if (listing.coverUrl != null && listing.coverUrl !== '') {
      updateData.coverUrl = listing.coverUrl;
    }

    // Refresh the description only when this scrape produced one — never overwrite
    // a previously-known description with null/empty (graceful enrichment; W9a F2).
    if (listing.description != null && listing.description !== '') {
      updateData.description = listing.description;
    }

    // Refresh edition metadata only when this scrape produced a usable value —
    // never overwrite a previously-known value with null (graceful enrichment;
    // book-metadata PRD).
    if (listing.publisher != null && listing.publisher !== '') {
      updateData.publisher = listing.publisher;
    }
    if (listing.language != null && listing.language !== '') {
      updateData.language = listing.language;
    }
    if (listing.format != null && listing.format !== '') {
      updateData.format = listing.format;
    }
    if (listing.series != null && listing.series !== '') {
      updateData.series = listing.series;
    }
    if (listing.publicationYear != null) {
      updateData.publicationYear = listing.publicationYear;
    }

    // Refresh categories only when the CLEANED result is non-empty — never
    // overwrite previously-known raw_categories with an empty array (graceful
    // enrichment; genres-taxonomy PRD G2).
    if (listing.rawCategories != null) {
      const cleaned = cleanRawCategories(listing.rawCategories);
      if (cleaned.length > 0) {
        updateData.rawCategories = cleaned;
      }
    }

    await tx.providerListing.update({
      where: { id: existing.id },
      data: updateData,
    });

    // Record a snapshot when price OR availability changed.
    const { created } = await recordPriceChange(tx, {
      providerListingId: existing.id,
      previous: {
        priceAmount: existing.priceAmount,
        priceCurrency: existing.priceCurrency,
        availability: existing.availability,
      },
      next: { priceAmount, priceCurrency, availability },
      recordedAt: scrapedAt,
    });

    await maybeAdvanceWatermark(tx, listing, scrapedAt);

    return { kind: 'listing-updated', canonicalBookId: existing.canonicalBookId, priceHistoryCreated: created };
  }
}

export async function markUnavailable(
  tx: Prisma.TransactionClient,
  ctx: { listing: RawProviderListing; scrapedAt: Date },
): Promise<UnavailableOutcome> {
  const { listing, scrapedAt } = ctx;
  const provider = mapProviderName(listing.provider);
  const availability = mapAvailability(listing.availability);
  const existing = await tx.providerListing.findUnique({
    where: { provider_url: { provider, url: listing.url } },
  });

  if (existing === null) {
    // New listing with no price — nothing to persist (priceAmount is NOT NULL).
    return { kind: 'skipped-new-no-price' };
  }

  await tx.providerListing.update({
    where: { id: existing.id },
    data: {
      availability,
      lastSeenAt: scrapedAt,
    },
  });

  // No new price (out of stock / parse miss), but availability may have changed.
  // Record a snapshot keyed on the last known price when availability changed.
  const { created } = await recordPriceChange(tx, {
    providerListingId: existing.id,
    previous: {
      priceAmount: existing.priceAmount,
      priceCurrency: existing.priceCurrency,
      availability: existing.availability,
    },
    next: {
      priceAmount: existing.priceAmount,
      priceCurrency: existing.priceCurrency,
      availability,
    },
    recordedAt: scrapedAt,
  });

  await maybeAdvanceWatermark(tx, listing, scrapedAt);

  return { kind: 'availability-updated', priceHistoryCreated: created };
}
