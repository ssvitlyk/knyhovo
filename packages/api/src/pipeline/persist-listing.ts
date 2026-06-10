import type { RawProviderListing, CanonicalBook, ProviderName, Currency, Availability } from '@knyhovo/shared';
import type { CanonicalBookId } from '@knyhovo/shared';
import type { MatchResult } from '@knyhovo/scrapers';
import { Prisma } from '@prisma/client';
import type { ListingPersistOutcome, UnavailableOutcome } from './types.js';

const PROVIDER_NAME_MAP: Record<ProviderName, 'YAKABOO' | 'BOOK_CLUB'> = {
  yakaboo: 'YAKABOO',
  'book-club': 'BOOK_CLUB',
};

export function mapProviderName(name: ProviderName): 'YAKABOO' | 'BOOK_CLUB' {
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
      },
    });

    await tx.priceHistoryPoint.create({
      data: {
        providerListingId: created.id,
        priceAmount,
        priceCurrency,
        recordedAt: scrapedAt,
      },
    });

    return { kind: 'listing-created', createdCanonical, priceHistoryCreated: true };
  } else {
    // EXISTING listing — do NOT change canonicalBookId
    const priceChanged =
      existing.priceAmount !== priceAmount || existing.priceCurrency !== priceCurrency;

    const updateData: {
      priceAmount: number;
      priceCurrency: 'UAH';
      title: string;
      author: string;
      lastSeenAt: Date;
      availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
      isbn?: string;
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

    await tx.providerListing.update({
      where: { id: existing.id },
      data: updateData,
    });

    if (priceChanged) {
      await tx.priceHistoryPoint.create({
        data: {
          providerListingId: existing.id,
          priceAmount,
          priceCurrency,
          recordedAt: scrapedAt,
        },
      });
    }

    return { kind: 'listing-updated', priceHistoryCreated: priceChanged };
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

  return { kind: 'availability-updated' };
}
