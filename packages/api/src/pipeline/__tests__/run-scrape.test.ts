import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { ScraperProvider, ScraperResult, RawProviderListing } from '@knyhovo/shared';
import { runScrapePipeline } from '../run-scrape.js';

// ── Fixed test dates ──────────────────────────────────────────────────────────
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');
const SCRAPED_AT = '2026-01-01T00:00:00.000Z';

// ── Fake scraper ──────────────────────────────────────────────────────────────
class FakeScraper implements ScraperProvider {
  constructor(
    readonly name: ScraperProvider['name'],
    private readonly result: ScraperResult,
  ) {}

  async scrape(): Promise<ScraperResult> {
    return this.result;
  }
}

// ── In-memory fake Prisma ─────────────────────────────────────────────────────
type FakeCanonicalRow = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  createdAt: Date;
};

type FakeProviderListingRow = {
  id: string;
  canonicalBookId: string;
  provider: string;
  title: string;
  author: string;
  isbn: string | null;
  priceAmount: number;
  priceCurrency: string;
  url: string;
  lastSeenAt: Date;
  availability: string;
  description?: string | null;
};

type FakePriceHistoryRow = {
  id: string;
  providerListingId: string;
  priceAmount: number;
  priceCurrency: string;
  availability: string;
  recordedAt: Date;
};

function makeFakePrisma(
  canonicalBooks: FakeCanonicalRow[] = [],
  providerListings: FakeProviderListingRow[] = [],
  priceHistory: FakePriceHistoryRow[] = [],
) {
  let bookCounter = 0;
  let listingCounter = 0;
  let historyCounter = 0;

  const db = {
    canonicalBook: {
      findMany: vi.fn(async () => [...canonicalBooks]),
      create: vi.fn(async ({ data }: { data: Omit<FakeCanonicalRow, 'id'> }) => {
        const row: FakeCanonicalRow = {
          id: `book-${++bookCounter}`,
          title: data.title,
          author: data.author,
          isbn: data.isbn ?? null,
          createdAt: data.createdAt ?? FIXED_DATE,
        };
        canonicalBooks.push(row);
        return row;
      }),
    },
    providerListing: {
      findUnique: vi.fn(
        async ({ where }: { where: { provider_url: { provider: string; url: string } } }) => {
          const { provider, url } = where.provider_url;
          return (
            providerListings.find((pl) => pl.provider === provider && pl.url === url) ?? null
          );
        },
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeProviderListingRow, 'id'> }) => {
        const row: FakeProviderListingRow = {
          id: `pl-${++listingCounter}`,
          ...data,
        };
        providerListings.push(row);
        return row;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<FakeProviderListingRow>;
        }) => {
          const idx = providerListings.findIndex((pl) => pl.id === where.id);
          if (idx !== -1) {
            providerListings[idx] = { ...providerListings[idx]!, ...data };
          }
          return providerListings[idx]!;
        },
      ),
    },
    priceHistoryPoint: {
      create: vi.fn(async ({ data }: { data: Omit<FakePriceHistoryRow, 'id'> }) => {
        const row: FakePriceHistoryRow = {
          id: `ph-${++historyCounter}`,
          ...data,
        };
        priceHistory.push(row);
        return row;
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };

  return { db, canonicalBooks, providerListings, priceHistory };
}

// ── Listing factory ───────────────────────────────────────────────────────────
function makeListing(overrides: Partial<RawProviderListing> = {}): RawProviderListing {
  return {
    provider: 'yakaboo',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    isbn: null,
    price: { amount: 34900, currency: 'UAH' },
    url: 'https://yakaboo.ua/kobzar',
    availability: 'in-stock',
    ...overrides,
  };
}

function makeScraperResult(listings: RawProviderListing[], errors: string[] = []): ScraperResult {
  return { provider: 'yakaboo', listings, scrapedAt: SCRAPED_AT, errors };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runScrapePipeline', () => {
  // Test 1: created canonical book
  it('creates canonical book when DB is empty and listing has no match', async () => {
    const { db, canonicalBooks } = makeFakePrisma();
    const listing = makeListing({ isbn: null });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    const { metrics } = results[0]!;
    expect(metrics.created).toBe(1);
    expect(metrics.providerListingsCreated).toBe(1);
    expect(metrics.priceHistoryCreated).toBe(1);
    expect(canonicalBooks).toHaveLength(1);
    expect(canonicalBooks[0]!.title).toBe('Кобзар');
  });

  // Test 2: matched existing canonical
  it('matches existing canonical by ISBN and does not create a new canonical row', async () => {
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-existing',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: '9786177933105',
      createdAt: FIXED_DATE,
    };
    const { db, canonicalBooks } = makeFakePrisma([existingCanonical]);

    const listing = makeListing({
      isbn: '9786177933105',
      url: 'https://yakaboo.ua/kobzar-new-url',
    });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    const { metrics } = results[0]!;
    expect(metrics.matched).toBe(1);
    expect(metrics.created).toBe(0);
    // Still only one canonical row (the pre-existing one)
    expect(canonicalBooks).toHaveLength(1);
    expect(metrics.providerListingsCreated).toBe(1);
  });

  // Test 3: conflict skipped and counted
  it('skips ISBN_CONFLICT listings and counts them', async () => {
    // Both listing and candidate have valid, different ISBNs → ISBN_CONFLICT
    // Titles are different enough that no fuzzy match occurs
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-conflict',
      title: 'Зовсім Інша Книга',
      author: 'Інший Автор',
      isbn: '9780061120084',
      createdAt: FIXED_DATE,
    };
    const { db, canonicalBooks, providerListings } = makeFakePrisma([existingCanonical]);

    const listing = makeListing({
      title: 'Кобзар Шевченка',
      author: 'Тарас Шевченко',
      isbn: '9786177933105',
      url: 'https://yakaboo.ua/kobzar-conflict',
    });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    const { metrics } = results[0]!;
    expect(metrics.conflicts).toBe(1);
    expect(metrics.conflictsByReason.ISBN_CONFLICT).toBe(1);
    expect(providerListings).toHaveLength(0);
    // No new canonical created (still only the pre-seeded one)
    expect(canonicalBooks).toHaveLength(1);
  });

  // Test 4: provider listing created (also validated in test 1, but explicit here)
  it('creates provider listing with correct canonicalBookId', async () => {
    const { db, providerListings, canonicalBooks } = makeFakePrisma();

    const listing = makeListing({ title: 'Нова Книга', isbn: null });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    expect(providerListings).toHaveLength(1);
    expect(canonicalBooks).toHaveLength(1);
    expect(providerListings[0]!.canonicalBookId).toBe(canonicalBooks[0]!.id);
  });

  // Test 5 & 6: provider listing updated, price changed → price history created
  it('updates existing provider listing and creates price history when price changes', async () => {
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-matched',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: '9786177933105',
      createdAt: FIXED_DATE,
    };
    const existingListing: FakeProviderListingRow = {
      id: 'pl-existing',
      canonicalBookId: 'book-matched',
      provider: 'YAKABOO',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: '9786177933105',
      priceAmount: 20000, // old price
      priceCurrency: 'UAH',
      url: 'https://yakaboo.ua/kobzar',
      lastSeenAt: FIXED_DATE,
      availability: 'IN_STOCK',
    };
    const { db, providerListings, priceHistory } = makeFakePrisma(
      [existingCanonical],
      [existingListing],
    );

    const listing = makeListing({
      isbn: '9786177933105',
      price: { amount: 34900, currency: 'UAH' }, // different price
    });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    const { metrics } = results[0]!;
    expect(metrics.providerListingsUpdated).toBe(1);
    expect(metrics.providerListingsCreated).toBe(0);
    expect(metrics.priceHistoryCreated).toBe(1);
    expect(priceHistory).toHaveLength(1);
    expect(providerListings[0]!.priceAmount).toBe(34900);
  });

  // Test 7: price unchanged → no price history
  it('does not create price history when price is unchanged', async () => {
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-same-price',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: '9786177933105',
      createdAt: FIXED_DATE,
    };
    const samePrice = 34900;
    const existingListing: FakeProviderListingRow = {
      id: 'pl-same',
      canonicalBookId: 'book-same-price',
      provider: 'YAKABOO',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: '9786177933105',
      priceAmount: samePrice,
      priceCurrency: 'UAH',
      url: 'https://yakaboo.ua/kobzar',
      lastSeenAt: FIXED_DATE,
      availability: 'IN_STOCK',
    };
    const { db, priceHistory } = makeFakePrisma([existingCanonical], [existingListing]);

    const listing = makeListing({
      isbn: '9786177933105',
      price: { amount: samePrice, currency: 'UAH' },
    });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    const { metrics } = results[0]!;
    expect(metrics.providerListingsUpdated).toBe(1);
    expect(metrics.priceHistoryCreated).toBe(0);
    expect(priceHistory).toHaveLength(0);
  });

  // Test 8: null price, new listing → skipped-new-no-price
  it('skips listings with null price and does not create canonical or provider listing', async () => {
    const { db, canonicalBooks, providerListings, priceHistory } = makeFakePrisma();

    const listing = makeListing({ price: null });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    const { metrics } = results[0]!;
    expect(metrics.skippedNoPrice).toBe(1);
    expect(metrics.availabilityUpdated).toBe(0);
    expect(metrics.priceHistoryCreated).toBe(0);
    expect(canonicalBooks).toHaveLength(0);
    expect(providerListings).toHaveLength(0);
    expect(priceHistory).toHaveLength(0);
  });

  // Test: same-run deduplication — a canonical created by the first listing
  // is immediately available to subsequent listings in the same run.
  it('deduplicates two listings of the same book within one run into a single canonical', async () => {
    const { db, canonicalBooks, providerListings } = makeFakePrisma();

    // Same book, two providers/URLs in the same scrape run, ISBN-less so the
    // second listing must match the first via the in-memory candidate it created.
    const listing1 = makeListing({
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      url: 'https://yakaboo.ua/kobzar-1',
    });
    const listing2 = makeListing({
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      url: 'https://yakaboo.ua/kobzar-2',
    });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing1, listing2]));

    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    const { metrics } = results[0]!;
    // First listing creates the canonical, second matches it in-memory.
    expect(metrics.created).toBe(1);
    expect(metrics.matched).toBe(1);
    // Exactly one canonical, two provider listings both pointing at it.
    expect(canonicalBooks).toHaveLength(1);
    expect(providerListings).toHaveLength(2);
    expect(providerListings[0]!.canonicalBookId).toBe(canonicalBooks[0]!.id);
    expect(providerListings[1]!.canonicalBookId).toBe(canonicalBooks[0]!.id);
  });

  // Test: null price + existing listing whose availability changes → availability
  // updated AND one price-history snapshot recorded (price OR availability rule).
  it('records a price-history snapshot when an existing listing goes out of stock with null price', async () => {
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-unavail',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      createdAt: FIXED_DATE,
    };
    const existingListing: FakeProviderListingRow = {
      id: 'pl-unavail',
      canonicalBookId: 'book-unavail',
      provider: 'YAKABOO',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      priceAmount: 20000,
      priceCurrency: 'UAH',
      url: 'https://yakaboo.ua/kobzar',
      lastSeenAt: FIXED_DATE,
      availability: 'IN_STOCK',
    };
    const { db, providerListings, priceHistory } = makeFakePrisma([existingCanonical], [existingListing]);

    const listing = makeListing({ price: null, availability: 'out-of-stock' });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    const { metrics } = results[0]!;
    expect(metrics.availabilityUpdated).toBe(1);
    expect(metrics.skippedNoPrice).toBe(0);
    expect(metrics.priceHistoryCreated).toBe(1);
    expect(priceHistory).toHaveLength(1);
    // Snapshot keeps the last known price and records the new availability.
    expect(priceHistory[0]!.priceAmount).toBe(20000);
    expect(priceHistory[0]!.availability).toBe('OUT_OF_STOCK');
    expect(providerListings[0]!.availability).toBe('OUT_OF_STOCK');
    expect(providerListings[0]!.lastSeenAt).toEqual(new Date(SCRAPED_AT));
    expect(providerListings[0]!.priceAmount).toBe(20000); // price unchanged
  });

  // Test: priced but out-of-stock listing → persisted with OUT_OF_STOCK availability
  it('persists a priced but out-of-stock listing with OUT_OF_STOCK availability', async () => {
    const { db, providerListings, priceHistory } = makeFakePrisma();

    const listing = makeListing({ price: { amount: 34900, currency: 'UAH' }, availability: 'out-of-stock' });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
    });

    const { metrics } = results[0]!;
    expect(metrics.created).toBe(1);
    expect(metrics.providerListingsCreated).toBe(1);
    expect(providerListings[0]!.availability).toBe('OUT_OF_STOCK');
    expect(priceHistory).toHaveLength(1);
  });

  // Test: availability transitions — unknown → in-stock
  it('transitions availability from UNKNOWN to IN_STOCK when scraped as in-stock', async () => {
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-trans-1',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      createdAt: FIXED_DATE,
    };
    const existingListing: FakeProviderListingRow = {
      id: 'pl-trans-1',
      canonicalBookId: 'book-trans-1',
      provider: 'YAKABOO',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      priceAmount: 34900,
      priceCurrency: 'UAH',
      url: 'https://yakaboo.ua/kobzar',
      lastSeenAt: FIXED_DATE,
      availability: 'UNKNOWN',
    };
    const { db, providerListings } = makeFakePrisma([existingCanonical], [existingListing]);

    const listing = makeListing({ price: { amount: 34900, currency: 'UAH' }, availability: 'in-stock' });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    await runScrapePipeline({ prisma: db as unknown as PrismaClient, providers: [scraper] });

    expect(providerListings[0]!.availability).toBe('IN_STOCK');
  });

  // Test: availability transitions — in-stock → out-of-stock (with price)
  it('transitions availability from IN_STOCK to OUT_OF_STOCK when scraped as out-of-stock with price', async () => {
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-trans-2',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      createdAt: FIXED_DATE,
    };
    const existingListing: FakeProviderListingRow = {
      id: 'pl-trans-2',
      canonicalBookId: 'book-trans-2',
      provider: 'YAKABOO',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      priceAmount: 34900,
      priceCurrency: 'UAH',
      url: 'https://yakaboo.ua/kobzar',
      lastSeenAt: FIXED_DATE,
      availability: 'IN_STOCK',
    };
    const { db, providerListings } = makeFakePrisma([existingCanonical], [existingListing]);

    const listing = makeListing({ price: { amount: 34900, currency: 'UAH' }, availability: 'out-of-stock' });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    await runScrapePipeline({ prisma: db as unknown as PrismaClient, providers: [scraper] });

    expect(providerListings[0]!.availability).toBe('OUT_OF_STOCK');
  });

  // Test: availability transitions — out-of-stock → in-stock
  it('transitions availability from OUT_OF_STOCK to IN_STOCK when scraped as in-stock', async () => {
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-trans-3',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      createdAt: FIXED_DATE,
    };
    const existingListing: FakeProviderListingRow = {
      id: 'pl-trans-3',
      canonicalBookId: 'book-trans-3',
      provider: 'YAKABOO',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      priceAmount: 34900,
      priceCurrency: 'UAH',
      url: 'https://yakaboo.ua/kobzar',
      lastSeenAt: FIXED_DATE,
      availability: 'OUT_OF_STOCK',
    };
    const { db, providerListings } = makeFakePrisma([existingCanonical], [existingListing]);

    const listing = makeListing({ price: { amount: 34900, currency: 'UAH' }, availability: 'in-stock' });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    await runScrapePipeline({ prisma: db as unknown as PrismaClient, providers: [scraper] });

    expect(providerListings[0]!.availability).toBe('IN_STOCK');
  });

  // Description enrichment (W9a F2): insert writes the scraped description.
  it('persists the scraped description on a new listing', async () => {
    const { db, providerListings } = makeFakePrisma();

    const listing = makeListing({ description: 'Санітизований опис книги.' });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    await runScrapePipeline({ prisma: db as unknown as PrismaClient, providers: [scraper] });

    expect(providerListings).toHaveLength(1);
    expect(providerListings[0]!.description).toBe('Санітизований опис книги.');
  });

  // Description enrichment: a re-scrape with a non-empty description refreshes it.
  it('refreshes an existing description when the re-scrape provides a non-empty one', async () => {
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-desc-1',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      createdAt: FIXED_DATE,
    };
    const existingListing: FakeProviderListingRow = {
      id: 'pl-desc-1',
      canonicalBookId: 'book-desc-1',
      provider: 'YAKABOO',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      priceAmount: 34900,
      priceCurrency: 'UAH',
      url: 'https://yakaboo.ua/kobzar',
      lastSeenAt: FIXED_DATE,
      availability: 'IN_STOCK',
      description: 'Старий опис.',
    };
    const { db, providerListings } = makeFakePrisma([existingCanonical], [existingListing]);

    const listing = makeListing({ description: 'Новий опис.' });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    await runScrapePipeline({ prisma: db as unknown as PrismaClient, providers: [scraper] });

    expect(providerListings[0]!.description).toBe('Новий опис.');
  });

  // Description enrichment: a re-scrape WITHOUT a description never nulls an existing one.
  it('keeps an existing description when the re-scrape carries none (no null-overwrite)', async () => {
    const existingCanonical: FakeCanonicalRow = {
      id: 'book-desc-2',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      createdAt: FIXED_DATE,
    };
    const existingListing: FakeProviderListingRow = {
      id: 'pl-desc-2',
      canonicalBookId: 'book-desc-2',
      provider: 'YAKABOO',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      priceAmount: 34900,
      priceCurrency: 'UAH',
      url: 'https://yakaboo.ua/kobzar',
      lastSeenAt: FIXED_DATE,
      availability: 'IN_STOCK',
      description: 'Збережений опис.',
    };
    const { db, providerListings } = makeFakePrisma([existingCanonical], [existingListing]);

    // Catalog-only re-scrape: no description field (enrichment did not run).
    const listing = makeListing({ price: { amount: 39900, currency: 'UAH' } });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing]));

    await runScrapePipeline({ prisma: db as unknown as PrismaClient, providers: [scraper] });

    expect(providerListings[0]!.description).toBe('Збережений опис.');
    expect(providerListings[0]!.priceAmount).toBe(39900); // other fields still update
  });

  // Test 9: one listing failure does not stop the run
  it('continues processing after one listing failure', async () => {
    const { db, providerListings } = makeFakePrisma();

    let createCallCount = 0;
    // Override providerListing.create to throw on first call
    db.providerListing.create = vi.fn(async ({ data }: { data: Omit<FakeProviderListingRow, 'id'> }) => {
      createCallCount++;
      if (createCallCount === 1) {
        throw new Error('DB error on first listing');
      }
      const row: FakeProviderListingRow = {
        id: `pl-${createCallCount}`,
        ...data,
      };
      providerListings.push(row);
      return row;
    });

    const listing1 = makeListing({ url: 'https://yakaboo.ua/book-1', title: 'Книга 1' });
    const listing2 = makeListing({ url: 'https://yakaboo.ua/book-2', title: 'Книга 2' });
    const scraper = new FakeScraper('yakaboo', makeScraperResult([listing1, listing2]));

    const errorLogger = vi.fn();
    const { results } = await runScrapePipeline({
      prisma: db as unknown as PrismaClient,
      providers: [scraper],
      logger: { info: () => undefined, error: errorLogger },
    });

    const { metrics } = results[0]!;
    expect(metrics.errors).toBe(1);
    expect(metrics.providerListingsCreated).toBe(1);
    expect(errorLogger).toHaveBeenCalledOnce();
    expect(results).toHaveLength(1);
  });
});
