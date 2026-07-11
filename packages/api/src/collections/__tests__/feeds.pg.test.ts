/**
 * C1 real-Postgres equivalence: proves the SQL feed queries in `repository.ts`
 * return the same page ids + total as the pre-C1 in-JS reference
 * (`reference-feeds.ts`) on a deterministic seeded fixture.
 *
 * Gated on `TEST_DATABASE_URL` — skipped entirely otherwise (e.g. CI without
 * a Postgres instance, or a local run without the test DB set up).
 *
 * Setup (local): a `knyhovo_test` database on the same Postgres instance as
 * dev, with migrations applied:
 *
 *   docker exec knyhovo-db-1 psql -U knyhovo -d postgres -c "CREATE DATABASE knyhovo_test"
 *   DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx vitest run src/collections/__tests__/feeds.pg.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  queryDynamicFeedIds,
  countDynamicFeed,
  novynkyPoolMeta,
  queryNovynkyIds,
  countNovynky,
  queryTaxonomicFeedIds,
  countTaxonomicFeed,
  queryEditorialFeedIds,
  countEditorialFeed,
  findGenreIdBySlug,
} from '../repository.js';
import type { CollectionBookRow } from '../repository.js';
import type { SortOption } from '../dto.js';
import { planNovynkyPool } from '../feed-constants.js';
import {
  resolveDynamicFeed,
  resolveTaxonomicFeed,
  resolveEditorialFeed,
  applySort,
  applyFilters,
  paginate,
} from './reference-feeds.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const FIXED_NOW = new Date('2026-07-11T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number): Date => new Date(FIXED_NOW.getTime() - n * DAY_MS);

describe.skipIf(!TEST_DATABASE_URL)('collections SQL feeds — Postgres equivalence (C1)', () => {
  const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  const GENRE_ID = 'genre-fixture-1';
  const EDITORIAL_ID = 'editorial-fixture-1';

  async function fetchAllRows(): Promise<CollectionBookRow[]> {
    return prisma.canonicalBook.findMany({
      select: {
        id: true,
        title: true,
        author: true,
        createdAt: true,
        genreId: true,
        listings: {
          select: {
            provider: true,
            priceAmount: true,
            priceCurrency: true,
            availability: true,
            coverUrl: true,
            priceHistory: { select: { priceAmount: true, priceCurrency: true, recordedAt: true } },
          },
        },
      },
    }) as unknown as Promise<CollectionBookRow[]>;
  }

  async function wishlistCounts(): Promise<Map<string, number>> {
    const rows = await prisma.wishlistItem.groupBy({ by: ['canonicalBookId'], _count: { _all: true } });
    return new Map(rows.map((r) => [r.canonicalBookId, r._count._all]));
  }

  beforeAll(async () => {
    await prisma.priceHistoryPoint.deleteMany({});
    await prisma.wishlistItem.deleteMany({});
    await prisma.collectionItem.deleteMany({});
    await prisma.providerListing.deleteMany({});
    await prisma.canonicalBook.deleteMany({});
    await prisma.collection.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.collection.create({
      data: { id: GENRE_ID, slug: 'fixture-genre', type: 'TAXONOMIC', name: 'Fixture Genre', description: '' },
    });
    await prisma.collection.create({
      data: { id: EDITORIAL_ID, slug: 'fixture-editorial', type: 'EDITORIAL', name: 'Fixture Editorial', description: '' },
    });
    const user = await prisma.user.create({ data: { id: 'user-fixture-1', email: 'fixture@example.com' } });
    const user2 = await prisma.user.create({ data: { id: 'user-fixture-2', email: 'fixture2@example.com' } });

    type Seed = {
      id: string;
      title: string;
      createdAt: Date;
      genreId?: string;
      listing?: {
        priceAmount: number;
        availability?: 'IN_STOCK' | 'OUT_OF_STOCK';
        history?: { priceAmount: number; recordedAt: Date }[];
      };
    };

    // Every priced seed below uses a globally distinct `priceAmount`/discount% —
    // deliberately, so `price_asc`/`price_desc`/`discount_desc` equivalence
    // assertions aren't sensitive to *coincidental* ties (real tie-break behavior
    // differs from the pre-C1 JS by design — a documented semantic choice, see
    // the C1 report — not something this fixture needs to exercise). Exception:
    // the `p-disc-round-*` pair below collides on the ROUNDED discount% on
    // purpose, pinning the exact-float (never rounded) discount ordering.
    const seeds: Seed[] = [
      // Priced, no history, in stock — plain baseline (also editorial + genre membership).
      { id: 'p-plain-1', title: 'Plain One', createdAt: daysAgo(100), genreId: GENRE_ID, listing: { priceAmount: 5001 } },
      { id: 'p-plain-2', title: 'Plain Two', createdAt: daysAgo(90), genreId: GENRE_ID, listing: { priceAmount: 8000 } },
      // Unpriced.
      { id: 'p-unpriced', title: 'Unpriced', createdAt: daysAgo(80) },
      // Out of stock.
      {
        id: 'p-oos',
        title: 'Out Of Stock',
        createdAt: daysAgo(70),
        listing: { priceAmount: 3000, availability: 'OUT_OF_STOCK' },
      },
      // znyzhky: real historical drop.
      {
        id: 'p-drop-big',
        title: 'Big Drop',
        createdAt: daysAgo(60),
        listing: { priceAmount: 5010, history: [{ priceAmount: 10000, recordedAt: daysAgo(20) }] },
      },
      {
        id: 'p-drop-small',
        title: 'Small Drop',
        createdAt: daysAgo(59),
        listing: { priceAmount: 9020, history: [{ priceAmount: 10000, recordedAt: daysAgo(20) }] },
      },
      // ponyzhena-tsina: recent (7d) drop.
      {
        id: 'p-recent-fall',
        title: 'Recent Fall',
        createdAt: daysAgo(58),
        listing: { priceAmount: 5200, history: [{ priceAmount: 9000, recordedAt: daysAgo(9) }] },
      },
      {
        id: 'p-too-recent',
        title: 'Too Recent',
        createdAt: daysAgo(57),
        listing: { priceAmount: 9030, history: [{ priceAmount: 12000, recordedAt: daysAgo(2) }] },
      },
      // rekordno-nyzka-tsina: all-time low with >= 2 points, and a 1-point exclusion.
      {
        id: 'p-all-time-low',
        title: 'All Time Low',
        createdAt: daysAgo(56),
        listing: {
          priceAmount: 4000,
          // highest-above-current = 7200 -> discount 44%, distinct from p-drop-big's 50%.
          history: [
            { priceAmount: 7200, recordedAt: daysAgo(40) },
            { priceAmount: 6000, recordedAt: daysAgo(20) },
          ],
        },
      },
      {
        id: 'p-scraped-once',
        title: 'Scraped Once',
        createdAt: daysAgo(55),
        listing: { priceAmount: 5040, history: [{ priceAmount: 5040, recordedAt: daysAgo(1) }] },
      },
      // Deliberate ROUNDED-discount collision: both round to 24%, but differ as
      // exact ratios — 23.636...% vs exactly 24.0%. The pre-C1 JS znyzhky order
      // used the exact float, so p-disc-round-b (24.0%) must rank above
      // p-disc-round-a (23.636%); a ROUND()ed ORDER BY key would call them tied
      // and the id ASC tie-break would then wrongly put p-disc-round-a first.
      {
        id: 'p-disc-round-a',
        title: 'Rounds To 24 Low',
        createdAt: daysAgo(54),
        listing: { priceAmount: 8400, history: [{ priceAmount: 11000, recordedAt: daysAgo(20) }] }, // exact 23.636% -> rounds to 24
      },
      {
        id: 'p-disc-round-b',
        title: 'Rounds To 24 High',
        createdAt: daysAgo(53),
        listing: { priceAmount: 7600, history: [{ priceAmount: 10000, recordedAt: daysAgo(20) }] }, // exact 24.0% -> rounds to 24
      },
      // novynky window (< 30 days).
      { id: 'p-new-1', title: 'New One', createdAt: daysAgo(5), listing: { priceAmount: 4010 } },
      { id: 'p-new-2', title: 'New Two', createdAt: daysAgo(3), listing: { priceAmount: 4500 } },
    ];

    // Pad the priced catalog so novynky's 25%-cap/fallback math is exercised deterministically.
    for (let i = 0; i < 20; i += 1) {
      seeds.push({ id: `p-pad-${i}`, title: `Pad ${i}`, createdAt: daysAgo(200 + i), listing: { priceAmount: 6100 + i } });
    }

    for (const s of seeds) {
      await prisma.canonicalBook.create({
        data: { id: s.id, title: s.title, author: 'Fixture Author', createdAt: s.createdAt, genreId: s.genreId ?? null },
      });
      if (s.listing) {
        const l = await prisma.providerListing.create({
          data: {
            canonicalBookId: s.id,
            provider: 'YAKABOO',
            title: s.title,
            author: 'Fixture Author',
            priceAmount: s.listing.priceAmount,
            priceCurrency: 'UAH',
            url: `https://example.test/${s.id}`,
            lastSeenAt: FIXED_NOW,
            availability: s.listing.availability ?? 'IN_STOCK',
          },
        });
        for (const h of s.listing.history ?? []) {
          await prisma.priceHistoryPoint.create({
            data: {
              providerListingId: l.id,
              priceAmount: h.priceAmount,
              priceCurrency: 'UAH',
              availability: s.listing.availability ?? 'IN_STOCK',
              recordedAt: h.recordedAt,
            },
          });
        }
      }
    }

    await prisma.wishlistItem.createMany({
      data: [
        // p-plain-2 gets 2 wishlists (vs. p-all-time-low's 1) — deliberately distinct
        // counts, so najbilsh-bazhani/populyarne-zaraz relevance order is unambiguous.
        { userId: user.id, canonicalBookId: 'p-plain-2' },
        { userId: user2.id, canonicalBookId: 'p-plain-2' },
        { userId: user.id, canonicalBookId: 'p-all-time-low' },
      ],
    });

    await prisma.collectionItem.createMany({
      data: [
        { collectionId: EDITORIAL_ID, canonicalBookId: 'p-plain-2', sortOrder: 0 },
        { collectionId: EDITORIAL_ID, canonicalBookId: 'p-plain-1', sortOrder: 1 },
        { collectionId: EDITORIAL_ID, canonicalBookId: 'p-unpriced', sortOrder: 2 },
      ],
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function expectFeedMatches(
    slug: 'znyzhky' | 'ponyzhena-tsina' | 'najbilsh-bazhani' | 'rekordno-nyzka-tsina' | 'populyarne-zaraz',
    sort: SortOption,
  ) {
    const allRows = await fetchAllRows();
    const counts = await wishlistCounts();
    const refBooks = resolveDynamicFeed(slug, allRows, { wishlistCounts: counts }, FIXED_NOW);
    const relevanceOrder = refBooks.map((b) => b.id);
    const sorted = applySort(refBooks, sort, relevanceOrder);
    const expectedIds = paginate(sorted, 1, 24).map((b) => b.id);

    const sqlIds = await queryDynamicFeedIds(prisma, slug, { sort, page: 1, perPage: 24, now: FIXED_NOW });
    const sqlTotal = await countDynamicFeed(prisma, slug, {}, FIXED_NOW);

    expect(sqlIds).toEqual(expectedIds);
    expect(sqlTotal).toBe(sorted.length);
  }

  it('znyzhky: relevance order + total match the reference', async () => {
    await expectFeedMatches('znyzhky', 'relevance');
  });

  it('ponyzhena-tsina: relevance order + total match the reference', async () => {
    await expectFeedMatches('ponyzhena-tsina', 'relevance');
  });

  it('najbilsh-bazhani: relevance order + total match the reference', async () => {
    await expectFeedMatches('najbilsh-bazhani', 'relevance');
  });

  it('rekordno-nyzka-tsina: relevance order + total match the reference (excludes the 1-point book)', async () => {
    await expectFeedMatches('rekordno-nyzka-tsina', 'relevance');
    const ids = await queryDynamicFeedIds(prisma, 'rekordno-nyzka-tsina', {
      sort: 'relevance',
      page: 1,
      perPage: 24,
      now: FIXED_NOW,
    });
    expect(ids).not.toContain('p-scraped-once');
    expect(ids).toContain('p-all-time-low');
  });

  it('populyarne-zaraz: composite relevance order matches the reference', async () => {
    await expectFeedMatches('populyarne-zaraz', 'relevance');
  });

  it('populyarne-zaraz: price_asc (a generic sort, available on any feed) matches the reference', async () => {
    // Every priced seed carries a globally distinct price -> no tie-break ambiguity.
    await expectFeedMatches('populyarne-zaraz', 'price_asc');
  });

  it('znyzhky: discount_desc (the generic sort also usable on its "home" feed) matches the reference', async () => {
    // znyzhky's own pool is already restricted to books with a real discount, so
    // (unlike most feeds, where most books have no discount and tie at -1) there's
    // no null-discount tie-break ambiguity here.
    await expectFeedMatches('znyzhky', 'discount_desc');
  });

  it('discount ordering uses the exact ratio, not the rounded percent: 24.0% ranks above 23.636% (both round to 24)', async () => {
    // A rounded ORDER BY key would call p-disc-round-a/b tied and let the id ASC
    // tie-break wrongly put p-disc-round-a (23.636%, lexicographically first) first.
    for (const sort of ['relevance', 'discount_desc'] as const) {
      const ids = await queryDynamicFeedIds(prisma, 'znyzhky', { sort, page: 1, perPage: 24, now: FIXED_NOW });
      const posA = ids.indexOf('p-disc-round-a');
      const posB = ids.indexOf('p-disc-round-b');
      expect(posA).toBeGreaterThanOrEqual(0);
      expect(posB).toBeGreaterThanOrEqual(0);
      expect(posB).toBeLessThan(posA);
    }
  });

  it('novynky: pool plan (window+fallback+cap) + order match the reference', async () => {
    const allRows = await fetchAllRows();
    const counts = await wishlistCounts();
    const refBooks = resolveDynamicFeed('novynky', allRows, { wishlistCounts: counts }, FIXED_NOW);
    const relevanceOrder = refBooks.map((b) => b.id);
    const sorted = applySort(refBooks, 'relevance', relevanceOrder);
    const expectedIds = paginate(sorted, 1, 24).map((b) => b.id);

    const meta = await novynkyPoolMeta(prisma, FIXED_NOW);
    const plan = planNovynkyPool(meta.windowCount, meta.totalPriced);
    const sqlIds = await queryNovynkyIds(prisma, { sort: 'relevance', page: 1, perPage: 24, now: FIXED_NOW }, plan.windowLimit, plan.fallbackLimit);
    const sqlTotal = await countNovynky(prisma, {}, FIXED_NOW, plan.windowLimit, plan.fallbackLimit);

    expect(sqlIds).toEqual(expectedIds);
    expect(sqlTotal).toBe(sorted.length);
  });

  it('taxonomic (genre) feed: default relevance order + total match the reference', async () => {
    const allRows = await fetchAllRows();
    const counts = await wishlistCounts();
    const refBooks = resolveTaxonomicFeed(allRows, GENRE_ID, { wishlistCounts: counts });
    const relevanceOrder = refBooks.map((b) => b.id);
    const sorted = applySort(refBooks, 'relevance', relevanceOrder);
    const expectedIds = paginate(sorted, 1, 24).map((b) => b.id);

    const sqlIds = await queryTaxonomicFeedIds(prisma, GENRE_ID, { sort: 'relevance', page: 1, perPage: 24, now: FIXED_NOW });
    const sqlTotal = await countTaxonomicFeed(prisma, GENRE_ID, {}, FIXED_NOW);

    expect(sqlIds).toEqual(expectedIds);
    expect(sqlTotal).toBe(sorted.length);
  });

  it('taxonomic feed: price_asc includes the unpriced book (via genre membership) — none seeded, so just the two priced books ordered', async () => {
    const ids = await queryTaxonomicFeedIds(prisma, GENRE_ID, { sort: 'price_asc', page: 1, perPage: 24, now: FIXED_NOW });
    expect(ids).toEqual(['p-plain-1', 'p-plain-2']);
  });

  it('editorial feed: relevance (sortOrder) order + total match the reference, unpriced book stays in pool', async () => {
    const allRows = await fetchAllRows();
    const counts = await wishlistCounts();
    const orderedIds = ['p-plain-2', 'p-plain-1', 'p-unpriced'];
    const refBooks = resolveEditorialFeed(allRows, orderedIds, { wishlistCounts: counts });
    const sorted = applySort(refBooks, 'relevance', orderedIds);
    const expectedIds = paginate(sorted, 1, 24).map((b) => b.id);

    const sqlIds = await queryEditorialFeedIds(prisma, EDITORIAL_ID, { sort: 'relevance', page: 1, perPage: 24, now: FIXED_NOW });
    const sqlTotal = await countEditorialFeed(prisma, EDITORIAL_ID, {}, FIXED_NOW);

    expect(sqlIds).toEqual(expectedIds);
    expect(sqlTotal).toBe(sorted.length);
  });

  it('generic ?genre= filter resolves via findGenreIdBySlug and narrows a non-taxonomic feed', async () => {
    const genreId = await findGenreIdBySlug(prisma, 'fixture-genre');
    expect(genreId).toBe(GENRE_ID);

    const ids = await queryEditorialFeedIds(prisma, EDITORIAL_ID, {
      sort: 'relevance',
      page: 1,
      perPage: 24,
      now: FIXED_NOW,
      genreId: genreId ?? undefined,
    });
    // Of the 3 editorial books, only p-plain-1/p-plain-2 carry GENRE_ID.
    expect(ids.sort()).toEqual(['p-plain-1', 'p-plain-2']);
  });

  it('generic price_min/price_max/in_stock filters narrow a dynamic feed the same as the reference', async () => {
    const allRows = await fetchAllRows();
    const counts = await wishlistCounts();
    const refBooks = resolveDynamicFeed('populyarne-zaraz', allRows, { wishlistCounts: counts }, FIXED_NOW);
    const filtered = applyFilters(refBooks, false, { priceMin: 4000, priceMax: 6000, inStockOnly: true }, new Map(), new Map());
    const sorted = applySort(filtered, 'relevance', refBooks.map((b) => b.id));
    const expectedIds = paginate(sorted, 1, 24).map((b) => b.id);

    const sqlIds = await queryDynamicFeedIds(prisma, 'populyarne-zaraz', {
      sort: 'relevance',
      page: 1,
      perPage: 24,
      now: FIXED_NOW,
      priceMin: 4000,
      priceMax: 6000,
      inStockOnly: true,
    });

    expect(sqlIds.sort()).toEqual(expectedIds.sort());
  });

  it('pagination: page 2 of populyarne-zaraz matches the reference slice', async () => {
    const allRows = await fetchAllRows();
    const counts = await wishlistCounts();
    const refBooks = resolveDynamicFeed('populyarne-zaraz', allRows, { wishlistCounts: counts }, FIXED_NOW);
    const sorted = applySort(refBooks, 'relevance', refBooks.map((b) => b.id));
    const expectedPage2 = paginate(sorted, 2, 10).map((b) => b.id);

    const sqlPage2 = await queryDynamicFeedIds(prisma, 'populyarne-zaraz', {
      sort: 'relevance',
      page: 2,
      perPage: 10,
      now: FIXED_NOW,
    });

    expect(sqlPage2).toEqual(expectedPage2);
  });
});
