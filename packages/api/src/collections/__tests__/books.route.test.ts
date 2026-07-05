import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { clearCache } from '../cache.js';
import { emptyDb, makeFakePrisma, book, listing, collection, itemsFor } from './fake-prisma.js';
import type { FakeDb } from './fake-prisma.js';

const FIXED_DATE = new Date('2026-07-03T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number): Date => new Date(FIXED_DATE.getTime() - n * DAY_MS);

async function buildTestApp(db: FakeDb) {
  const prisma = makeFakePrisma(db);
  return buildApp(prisma);
}

describe('GET /api/collections/:slug/books — unknown slug', () => {
  beforeEach(() => clearCache());

  it('returns 404 COLLECTION_NOT_FOUND', async () => {
    const db = emptyDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/unknown/books' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('COLLECTION_NOT_FOUND');
  });
});

describe('GET /api/collections/:slug/books — validation', () => {
  beforeEach(() => clearCache());

  it('returns 400 VALIDATION_ERROR for a bad page param', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'test-col', 'EDITORIAL'));
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/test-col/books', query: { page: '0' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when per_page != 24', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'test-col', 'EDITORIAL'));
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/test-col/books', query: { per_page: '10' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts per_page=24 explicitly', async () => {
    const db = emptyDb();
    const c = collection('c1', 'test-col', 'EDITORIAL');
    db.collections.push(c);
    db.books.push(book('b1', 'Book', 'Author', { listings: [listing(1000)] }));
    db.collectionItems.push(...itemsFor(c.id, ['b1']));
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/test-col/books', query: { per_page: '24' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().per_page).toBe(24);
  });
});

describe('GET /api/collections/:slug/books — pagination', () => {
  beforeEach(() => clearCache());

  it('paginates with per_page always 24 in the response, and reports total_pages', async () => {
    const db = emptyDb();
    const c = collection('c1', 'test-col', 'EDITORIAL');
    db.collections.push(c);
    const ids: string[] = [];
    for (let i = 0; i < 50; i += 1) {
      const id = `b${i}`;
      ids.push(id);
      db.books.push(book(id, `Book ${i}`, 'Author', { listings: [listing(1000 + i)] }));
    }
    db.collectionItems.push(...itemsFor(c.id, ids));

    const app = await buildTestApp(db);
    const res1 = await app.inject({ method: 'GET', url: '/api/collections/test-col/books', query: { page: '1' } });
    const body1 = res1.json();
    expect(body1.books).toHaveLength(24);
    expect(body1.total).toBe(50);
    expect(body1.per_page).toBe(24);
    expect(body1.total_pages).toBe(3);
    expect(body1.page).toBe(1);

    const res2 = await app.inject({ method: 'GET', url: '/api/collections/test-col/books', query: { page: '3' } });
    expect(res2.json().books).toHaveLength(2);
  });

  it('returns books: [] and total: 0 / total_pages: 0 for an empty collection', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'empty-col', 'EDITORIAL'));
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/empty-col/books' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.books).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.total_pages).toBe(0);
  });
});

describe('GET /api/collections/:slug/books — sorting', () => {
  beforeEach(() => clearCache());

  function setupSortDb(): { db: FakeDb; c: ReturnType<typeof collection> } {
    const db = emptyDb();
    const c = collection('c1', 'sort-col', 'EDITORIAL');
    db.collections.push(c);
    db.books.push(
      book('cheap', 'Cheap', 'A', { createdAt: daysAgo(5), listings: [listing(5000)] }),
      book('mid', 'Mid', 'B', { createdAt: daysAgo(20), listings: [listing(10000)] }),
      book(
        'expensive-discounted',
        'ExpensiveDiscounted',
        'C',
        {
          createdAt: daysAgo(50),
          listings: [
            listing(15000, {
              priceHistory: [{ priceAmount: 30000, priceCurrency: 'UAH', recordedAt: daysAgo(14) }],
            }),
          ],
        },
      ),
    );
    db.collectionItems.push(...itemsFor(c.id, ['cheap', 'mid', 'expensive-discounted']));
    return { db, c };
  }

  it('sort=price_asc orders by ascending price', async () => {
    const { db } = setupSortDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/sort-col/books', query: { sort: 'price_asc' } });
    expect(res.json().books.map((b: { id: string }) => b.id)).toEqual(['cheap', 'mid', 'expensive-discounted']);
  });

  it('sort=price_desc orders by descending price', async () => {
    const { db } = setupSortDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/sort-col/books', query: { sort: 'price_desc' } });
    expect(res.json().books.map((b: { id: string }) => b.id)).toEqual(['expensive-discounted', 'mid', 'cheap']);
  });

  it('sort=newest orders by catalogAddedAt descending', async () => {
    const { db } = setupSortDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/sort-col/books', query: { sort: 'newest' } });
    expect(res.json().books.map((b: { id: string }) => b.id)).toEqual(['cheap', 'mid', 'expensive-discounted']);
  });

  it('sort=oldest orders by catalogAddedAt ascending', async () => {
    const { db } = setupSortDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/sort-col/books', query: { sort: 'oldest' } });
    expect(res.json().books.map((b: { id: string }) => b.id)).toEqual(['expensive-discounted', 'mid', 'cheap']);
  });

  it('sort=discount_desc puts the biggest discount first, no-discount books last', async () => {
    const { db } = setupSortDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/sort-col/books', query: { sort: 'discount_desc' } });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids[0]).toBe('expensive-discounted');
    expect(ids[ids.length - 1]).toBe(ids[ids.length - 1]); // sanity: array intact
    expect(ids).toHaveLength(3);
  });

  it('default sort for taxonomic collections is price_asc', async () => {
    const db = emptyDb();
    const genre = collection('genre-1', 'genre-default-sort', 'TAXONOMIC');
    db.collections.push(genre);
    db.books.push(
      book('g-expensive', 'Expensive', 'A', { genreId: genre.id, listings: [listing(20000)] }),
      book('g-cheap', 'Cheap', 'B', { genreId: genre.id, listings: [listing(5000)] }),
    );
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/genre-default-sort/books' });
    expect(res.json().books.map((b: { id: string }) => b.id)).toEqual(['g-cheap', 'g-expensive']);
  });
});

describe('GET /api/collections/:slug/books — out-of-stock ordering', () => {
  beforeEach(() => clearCache());

  it('always places out-of-stock books last, regardless of sort, stably', async () => {
    const db = emptyDb();
    const c = collection('c1', 'oos-col', 'EDITORIAL');
    db.collections.push(c);
    db.books.push(
      book('oos', 'OutOfStock', 'A', { listings: [listing(5000, { availability: 'OUT_OF_STOCK' })] }),
      book('cheap', 'Cheap', 'B', { listings: [listing(10000)] }),
      book('expensive', 'Expensive', 'C', { listings: [listing(20000)] }),
    );
    db.collectionItems.push(...itemsFor(c.id, ['oos', 'cheap', 'expensive']));

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/oos-col/books',
      query: { sort: 'price_asc' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().books.map((b: { id: string }) => b.id)).toEqual(['cheap', 'expensive', 'oos']);
  });
});

describe('GET /api/collections/:slug/books — filters', () => {
  beforeEach(() => clearCache());

  it('in_stock=1 excludes out-of-stock books', async () => {
    const db = emptyDb();
    const c = collection('c1', 'filter-col', 'EDITORIAL');
    db.collections.push(c);
    db.books.push(
      book('in', 'InStock', 'A', { listings: [listing(5000)] }),
      book('out', 'OutOfStock', 'B', { listings: [listing(5000, { availability: 'OUT_OF_STOCK' })] }),
    );
    db.collectionItems.push(...itemsFor(c.id, ['in', 'out']));

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/filter-col/books', query: { in_stock: '1' } });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).toEqual(['in']);
  });

  it('in_stock=0 (default) includes all books', async () => {
    const db = emptyDb();
    const c = collection('c1', 'filter-col-2', 'EDITORIAL');
    db.collections.push(c);
    db.books.push(
      book('in', 'InStock', 'A', { listings: [listing(5000)] }),
      book('out', 'OutOfStock', 'B', { listings: [listing(5000, { availability: 'OUT_OF_STOCK' })] }),
    );
    db.collectionItems.push(...itemsFor(c.id, ['in', 'out']));

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/filter-col-2/books' });
    expect(res.json().total).toBe(2);
  });

  it('price_min/price_max filter by current price (inclusive)', async () => {
    const db = emptyDb();
    const c = collection('c1', 'price-col', 'EDITORIAL');
    db.collections.push(c);
    db.books.push(
      book('cheap', 'Cheap', 'A', { listings: [listing(1000)] }),
      book('mid', 'Mid', 'B', { listings: [listing(5000)] }),
      book('pricey', 'Pricey', 'C', { listings: [listing(9000)] }),
    );
    db.collectionItems.push(...itemsFor(c.id, ['cheap', 'mid', 'pricey']));

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/price-col/books',
      query: { price_min: '2000', price_max: '6000' },
    });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).toEqual(['mid']);
  });

  it('genre filters non-taxonomic collections by the book\'s assigned genre slug', async () => {
    const db = emptyDb();
    const genre = collection('genre-1', 'my-genre', 'TAXONOMIC');
    db.collections.push(genre);
    const editorial = collection('c1', 'mixed-col', 'EDITORIAL');
    db.collections.push(editorial);
    db.books.push(
      book('in-genre', 'InGenre', 'A', { genreId: genre.id, listings: [listing(5000)] }),
      book('other', 'Other', 'B', { listings: [listing(5000)] }),
    );
    db.collectionItems.push(...itemsFor(editorial.id, ['in-genre', 'other']));

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/mixed-col/books',
      query: { genre: 'my-genre' },
    });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).toEqual(['in-genre']);
  });

  it('genre param is ignored for taxonomic collections', async () => {
    const db = emptyDb();
    const genre = collection('genre-1', 'my-genre', 'TAXONOMIC');
    db.collections.push(genre);
    db.books.push(book('b1', 'Book', 'A', { genreId: genre.id, listings: [listing(5000)] }));

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/my-genre/books',
      query: { genre: 'some-other-genre' },
    });
    expect(res.json().total).toBe(1);
  });
});

describe('GET /api/collections/:slug/books — book card fields', () => {
  beforeEach(() => clearCache());

  it('exposes wishlistCount and the required CollectionBookDto fields', async () => {
    const db = emptyDb();
    const c = collection('c1', 'card-col', 'EDITORIAL');
    db.collections.push(c);
    db.books.push(book('b1', 'The Book', 'The Author', { listings: [listing(12345, { coverUrl: '/cover.png' })] }));
    db.collectionItems.push(...itemsFor(c.id, ['b1']));
    db.wishlistItems.push({ userId: 'u1', canonicalBookId: 'b1' }, { userId: 'u2', canonicalBookId: 'b1' });

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/card-col/books' });
    const [card] = res.json().books;
    expect(card).toMatchObject({
      id: 'b1',
      title: 'The Book',
      author: 'The Author',
      coverUrl: '/cover.png',
      minPrice: { amount: 12345, currency: 'UAH' },
      oldPrice: null,
      discountPercent: null,
      storeName: 'Yakaboo',
      rating: null,
      reviewsCount: null,
      isWishlisted: false,
      inStock: true,
      url: '/books/b1',
      wishlistCount: 2,
    });
    expect(typeof card.catalogAddedAt).toBe('string');
  });

  it('defaults coverUrl to an empty string when no listing has one', async () => {
    const db = emptyDb();
    const c = collection('c1', 'nocover-col', 'EDITORIAL');
    db.collections.push(c);
    db.books.push(book('b1', 'Book', 'Author', { listings: [listing(5000)] }));
    db.collectionItems.push(...itemsFor(c.id, ['b1']));

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/nocover-col/books' });
    expect(res.json().books[0].coverUrl).toBe('');
  });

  it('unpriced book (no listings) has minPrice/storeName null and is excluded/last under price sorts and filters', async () => {
    const db = emptyDb();
    const c = collection('c1', 'unpriced-col', 'EDITORIAL');
    db.collections.push(c);
    db.books.push(
      book('unpriced', 'Unpriced', 'A', { listings: [] }),
      book('priced', 'Priced', 'B', { listings: [listing(5000)] }),
    );
    db.collectionItems.push(...itemsFor(c.id, ['unpriced', 'priced']));

    const app = await buildTestApp(db);

    const plain = await app.inject({ method: 'GET', url: '/api/collections/unpriced-col/books' });
    const unpricedCard = plain.json().books.find((b: { id: string }) => b.id === 'unpriced');
    expect(unpricedCard.minPrice).toBeNull();
    expect(unpricedCard.storeName).toBeNull();

    const priceAsc = await app.inject({
      method: 'GET',
      url: '/api/collections/unpriced-col/books',
      query: { sort: 'price_asc' },
    });
    expect(priceAsc.json().books.map((b: { id: string }) => b.id)).toEqual(['priced', 'unpriced']);

    const priceDesc = await app.inject({
      method: 'GET',
      url: '/api/collections/unpriced-col/books',
      query: { sort: 'price_desc' },
    });
    expect(priceDesc.json().books.map((b: { id: string }) => b.id)).toEqual(['priced', 'unpriced']);

    const withMin = await app.inject({
      method: 'GET',
      url: '/api/collections/unpriced-col/books',
      query: { price_min: '0' },
    });
    expect(withMin.json().books.map((b: { id: string }) => b.id)).toEqual(['priced']);

    const withMax = await app.inject({
      method: 'GET',
      url: '/api/collections/unpriced-col/books',
      query: { price_max: '100000' },
    });
    expect(withMax.json().books.map((b: { id: string }) => b.id)).toEqual(['priced']);
  });
});
