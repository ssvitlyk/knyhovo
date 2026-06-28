import type { RawProviderListing, CanonicalBook, ProviderName, Currency, Availability } from '@knyhovo/shared';
import type { CanonicalBookId } from '@knyhovo/shared';
import type { MatchResult } from '@knyhovo/scrapers';
import { Prisma } from '@prisma/client';
import type { ListingPersistOutcome, UnavailableOutcome } from './types.js';
import { recordPriceChange } from '../price-history/service.js';

const PROVIDER_NAME_MAP: Record<
  ProviderName,
  'YAKABOO' | 'BOOK_CLUB' | 'VIVAT' | 'BOOK_YE' | 'BOOKCHEF' | 'LABORATORY'
> = {
  yakaboo: 'YAKABOO',
  'book-club': 'BOOK_CLUB',
  vivat: 'VIVAT',
  'book-ye': 'BOOK_YE',
  bookchef: 'BOOKCHEF',
  laboratory: 'LABORATORY',
};

export function mapProviderName(
  name: ProviderName,
): 'YAKABOO' | 'BOOK_CLUB' | 'VIVAT' | 'BOOK_YE' | 'BOOKCHEF' | 'LABORATORY' {
  return PROVIDER_NAME_MAP[name];
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
        availability: mapAvailability(listing.availability),
        coverUrl: listing.coverUrl ?? null,
        description: listing.description ?? null,
      },
    });

    await recordPriceChange(tx, {
      providerListingId: created.id,
      previous: null,
      next: { priceAmount, priceCurrency, availability: mapAvailability(listing.availability) },
      recordedAt: scrapedAt,
    });

    return { kind: 'listing-created', createdCanonical, priceHistoryCreated: true };
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
    } = {
      priceAmount,
      priceCurrency,
      title: listing.title,
      author,
      lastSeenAt: scrapedAt,
      availability: mapAvailability(listing.availability),
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
      next: { priceAmount, priceCurrency, availability: mapAvailability(listing.availability) },
      recordedAt: scrapedAt,
    });

    return { kind: 'listing-updated', priceHistoryCreated: created };
  }
}

export async function markUnavailable(
  tx: Prisma.TransactionClient,
  ctx: { listing: RawProviderListing; scrapedAt: Date },
): Promise<UnavailableOutcome> {
  const { listing, scrapedAt } = ctx;
  const provider = mapProviderName(listing.provider);
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
      availability: mapAvailability(listing.availability),
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
      availability: mapAvailability(listing.availability),
    },
    recordedAt: scrapedAt,
  });

  return { kind: 'availability-updated', priceHistoryCreated: created };
}
