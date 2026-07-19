/**
 * Real-Postgres integration for the background enrichment engine
 * (megakniga-resumable-enrichment PRD test matrix rows 3, 6-partial, 9-unit
 * for PR1): seeded megakniga listings → run → batch-committed fill-only
 * updates verified against the live schema (uuid keyset, `rawCategories:
 * isEmpty` predicate), re-run finds zero candidates and fetches nothing,
 * partially-enriched rows only gain their missing fields.
 *
 * Gated on `TEST_DATABASE_URL` — skipped entirely otherwise (same pattern as
 * `genres/__tests__/backfill.pg.test.ts`). Pg suites truncate shared tables,
 * so run pg files one at a time:
 *
 *   docker exec knyhovo-db-1 psql -U knyhovo -d postgres -c "CREATE DATABASE knyhovo_test"
 *   DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx vitest run src/enrichment/__tests__/enrichment.pg.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, Provider } from '@prisma/client';
import type { HtmlFetcher } from '@knyhovo/scrapers';
import type { ExtractedProductDetails } from '@knyhovo/scrapers';
import { runEnrichment } from '../engine.js';
import type { ProviderEnrichmentConfig } from '../providers.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const LONG_DESCRIPTION =
  'Опис книги для інтеграційного тесту, достатньо довгий, щоб пройти будь-яку ' +
  'санітарну нормалізацію тексту без втрат і лишитися корисним для картки.';

const TEST_CONFIG: ProviderEnrichmentConfig = {
  extract: (html: string) => JSON.parse(html) as ExtractedProductDetails,
  delayMs: 0,
  timeoutMs: 1000,
  maxRetries: 0,
  retryBaseDelayMs: 1,
  retryMaxDelayMs: 2,
};

const DETAILS_BY_CODE: Record<string, ExtractedProductDetails> = {
  'enr-1': {
    description: LONG_DESCRIPTION,
    metadata: { isbn: '9786171501232', publisher: 'Віват', format: 'Тверда' },
    rawCategories: ['Книги', 'Проза'],
  },
  'enr-2': {
    description: LONG_DESCRIPTION,
    metadata: { isbn: '9789660112345', publisher: 'КСД', format: "М'яка" },
    rawCategories: ['Книги', 'Фентезі'],
  },
  // A non-book page: nothing usable, the row stays a candidate forever.
  'enr-3': { description: null, metadata: null },
};

function urlOf(code: string): string {
  return `https://www.megakniga.com.ua/products/${code}`;
}

function codeOf(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}

function makeFetcher(): { fetcher: HtmlFetcher; fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    fetcher: {
      fetch: (url: string): Promise<string> => {
        fetched.push(url);
        const details = DETAILS_BY_CODE[codeOf(url)];
        if (details === undefined) return Promise.reject(new Error(`no fixture for ${url}`));
        return Promise.resolve(JSON.stringify(details));
      },
    },
  };
}

const silentLogger = { info: (): void => {}, error: (): void => {} };

describe.skipIf(!TEST_DATABASE_URL)('background enrichment — Postgres integration', () => {
  const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  let bookId: string;

  beforeAll(async () => {
    await prisma.priceHistoryPoint.deleteMany({});
    await prisma.wishlistItem.deleteMany({});
    await prisma.collectionItem.deleteMany({});
    await prisma.providerListing.deleteMany({});
    await prisma.canonicalBook.deleteMany({});
    const book = await prisma.canonicalBook.create({
      data: { title: 'Enrichment fixture', author: 'Тест' },
    });
    bookId = book.id;
  });

  beforeEach(async () => {
    await prisma.providerListing.deleteMany({ where: { provider: Provider.MEGAKNIGA } });
  });

  afterAll(async () => {
    await prisma.providerListing.deleteMany({ where: { provider: Provider.MEGAKNIGA } });
    await prisma.canonicalBook.deleteMany({ where: { id: bookId } });
    await prisma.$disconnect();
  });

  async function seedListing(
    code: string,
    overrides: { description?: string; publisher?: string; isbn?: string } = {},
  ): Promise<string> {
    const row = await prisma.providerListing.create({
      data: {
        canonicalBookId: bookId,
        provider: Provider.MEGAKNIGA,
        title: `Книга ${code}`,
        author: 'Автор',
        priceAmount: 43210,
        priceCurrency: 'UAH',
        url: urlOf(code),
        lastSeenAt: new Date('2026-07-19T00:00:00.000Z'),
        ...overrides,
      },
      select: { id: true },
    });
    return row.id;
  }

  it('enriches seeded listings with batch-committed fill-only updates (real uuid keyset)', async () => {
    await seedListing('enr-1');
    await seedListing('enr-2');
    const { fetcher, fetched } = makeFetcher();

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 1, // forces multiple keyset batches over random uuids
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({
      totalCandidates: 2,
      processed: 2,
      enriched: 2,
      failed: 0,
      batches: 2,
      stoppedEarly: null,
    });
    expect(fetched).toHaveLength(2);

    const rows = await prisma.providerListing.findMany({
      where: { provider: Provider.MEGAKNIGA },
      orderBy: { url: 'asc' },
    });
    expect(rows[0]).toMatchObject({
      isbn: '9786171501232',
      publisher: 'Віват',
      format: 'Тверда',
      rawCategories: ['Книги', 'Проза'],
    });
    expect(rows[0]!.description).not.toBeNull();
    expect(rows[1]).toMatchObject({ isbn: '9789660112345', publisher: 'КСД' });
  });

  it('a partially-enriched row only gains its missing fields — existing values stay', async () => {
    await seedListing('enr-1', { description: 'існуючий опис', isbn: '9780000000000' });
    const { fetcher } = makeFetcher();

    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    const row = await prisma.providerListing.findFirst({
      where: { provider: Provider.MEGAKNIGA },
    });
    expect(row).toMatchObject({
      description: 'існуючий опис',
      isbn: '9780000000000',
      publisher: 'Віват',
      format: 'Тверда',
      rawCategories: ['Книги', 'Проза'],
    });
  });

  it('a re-run after full enrichment finds zero candidates and performs zero fetches', async () => {
    await seedListing('enr-1');
    const first = makeFetcher();
    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: first.fetcher,
      config: TEST_CONFIG,
    });
    expect(first.fetched).toHaveLength(1);

    const second = makeFetcher();
    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: second.fetcher,
      config: TEST_CONFIG,
    });
    expect(summary).toMatchObject({ totalCandidates: 0, processed: 0 });
    expect(second.fetched).toHaveLength(0);
  });

  it('a page with no usable data is processed without writes and without failing the run', async () => {
    await seedListing('enr-3');
    const { fetcher } = makeFetcher();

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({ processed: 1, enriched: 0, failed: 0 });
    const row = await prisma.providerListing.findFirst({
      where: { provider: Provider.MEGAKNIGA },
    });
    expect(row!.description).toBeNull();
    expect(row!.publisher).toBeNull();
  });
});
