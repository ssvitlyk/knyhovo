import type { RawProviderListing, CanonicalBook, ProviderName, Currency } from '@knyhovo/shared';
import type { CanonicalBookId } from '@knyhovo/shared';
import type { MatchResult } from '@knyhovo/scrapers';
import { Prisma } from '@prisma/client';
import type { PersistOutcome } from './types.js';

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

export async function persistListing(
  tx: Prisma.TransactionClient,
  ctx: { listing: RawProviderListing; result: MatchResult; scrapedAt: Date },
): Promise<PersistOutcome> {
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
      isbn?: string;
    } = {
      priceAmount,
      priceCurrency,
      title: listing.title,
      author,
      lastSeenAt: scrapedAt,
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
