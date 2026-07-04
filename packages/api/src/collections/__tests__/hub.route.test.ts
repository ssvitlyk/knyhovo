import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { clearCache } from '../cache.js';
import {
  emptyDb,
  makeFakePrisma,
  book,
  listing,
  collection,
  itemsFor,
} from './fake-prisma.js';
import type { FakeDb } from './fake-prisma.js';

const FEATURED_SLUG = 'knyhovyk-radyt';
const EDITORIAL_SLUGS = ['knyhovyk-radyt', 'pryhovani-skarby'];
const WEEKLY_SLUGS = ['buker-2026', 'ukr-fentezi', 'non-fikshn'];
const MOOD_SLUGS = ['zatyshnyj-vechir', 'pered-snom', 'pryhody', 'vidpustka', 'natkhnennia', 'korotki'];
const DYNAMIC_SLUGS = ['populyarne-zaraz', 'novynky', 'znyzhky', 'ponyzhena-tsina', 'najbilsh-bazhani', 'rekordno-nyzka-tsina'];

/** Populate a fully-shaped hub fixture: featured + 6 dynamic + 2 editorial + 3 weekly + 6 moods + N genres. */
function fullHubDb(): FakeDb {
  const db = emptyDb();

  // Featured (also one of the two editorial slugs).
  const featured = collection('col-featured', FEATURED_SLUG, 'EDITORIAL', { displayOrder: 1 });
  db.collections.push(featured);
  db.books.push(
    book('fb1', 'Featured One', 'Author A', { listings: [listing(10000)] }),
    book('fb2', 'Featured Two', 'Author B', { listings: [listing(11000)] }),
    book('fb3', 'Featured Three', 'Author C', { listings: [listing(12000)] }),
    book('fb4', 'Featured Four', 'Author D', { listings: [listing(13000)] }),
  );
  db.collectionItems.push(...itemsFor(featured.id, ['fb1', 'fb2', 'fb3', 'fb4']));

  // Second editorial slug.
  const skarby = collection('col-skarby', 'pryhovani-skarby', 'EDITORIAL', { displayOrder: 2 });
  db.collections.push(skarby);
  db.books.push(book('sb1', 'Skarby One', 'Author E', { listings: [listing(9000)] }));
  db.collectionItems.push(...itemsFor(skarby.id, ['sb1']));

  // Weekly collections.
  for (const [i, slug] of WEEKLY_SLUGS.entries()) {
    const c = collection(`col-weekly-${i}`, slug, 'EDITORIAL', { displayOrder: 10 + i });
    db.collections.push(c);
    const bookIdName = `wk${i}-1`;
    db.books.push(book(bookIdName, `Weekly ${i}`, 'Author W', { listings: [listing(8000)] }));
    db.collectionItems.push(...itemsFor(c.id, [bookIdName]));
  }

  // Mood collections.
  for (const [i, slug] of MOOD_SLUGS.entries()) {
    const c = collection(`col-mood-${i}`, slug, 'EDITORIAL', { displayOrder: 20 + i });
    db.collections.push(c);
    const bookIdName = `md${i}-1`;
    db.books.push(book(bookIdName, `Mood ${i}`, 'Author M', { listings: [listing(7000)] }));
    db.collectionItems.push(...itemsFor(c.id, [bookIdName]));
  }

  // Dynamic collections (metadata rows only — pools computed live).
  for (const [i, slug] of DYNAMIC_SLUGS.entries()) {
    db.collections.push(collection(`col-dyn-${i}`, slug, 'DYNAMIC', { displayOrder: i }));
  }

  // Genres: 2 eligible (>=30 books), 1 thin (<30).
  const genreA = collection('genre-a', 'genre-a', 'TAXONOMIC', { displayOrder: 1, name: 'Genre A' });
  const genreB = collection('genre-b', 'genre-b', 'TAXONOMIC', { displayOrder: 2, name: 'Genre B' });
  const genreThin = collection('genre-thin', 'genre-thin', 'TAXONOMIC', { displayOrder: 3, name: 'Thin Genre' });
  db.collections.push(genreA, genreB, genreThin);
  for (let i = 0; i < 30; i += 1) {
    db.books.push(book(`ga${i}`, `Genre A Book ${i}`, 'Author', { genreId: genreA.id, listings: [listing(5000)] }));
  }
  for (let i = 0; i < 31; i += 1) {
    db.books.push(book(`gb${i}`, `Genre B Book ${i}`, 'Author', { genreId: genreB.id, listings: [listing(5000)] }));
  }
  for (let i = 0; i < 5; i += 1) {
    db.books.push(book(`gt${i}`, `Thin Book ${i}`, 'Author', { genreId: genreThin.id, listings: [listing(5000)] }));
  }

  return db;
}

async function buildTestApp(db: FakeDb) {
  const prisma = makeFakePrisma(db);
  return buildApp(prisma);
}

describe('GET /api/collections/hub', () => {
  beforeEach(() => {
    clearCache();
  });

  it('returns the 6 top-level keys with the expected shapes and sizes', async () => {
    const db = fullHubDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/hub' });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(Object.keys(body).sort()).toEqual(['dynamic', 'editorial', 'featured', 'genres', 'moods', 'weekly']);

    expect(body.featured.collection.slug).toBe(FEATURED_SLUG);
    expect(body.featured.previewBooks).toHaveLength(3);

    expect(body.dynamic).toHaveLength(6);
    expect(body.editorial).toHaveLength(2);
    expect(body.editorial.map((c: { slug: string }) => c.slug).sort()).toEqual([...EDITORIAL_SLUGS].sort());
    expect(body.weekly).toHaveLength(3);
    expect(body.weekly.map((c: { slug: string }) => c.slug).sort()).toEqual([...WEEKLY_SLUGS].sort());
    expect(body.moods).toHaveLength(6);
    expect(body.moods.map((c: { slug: string }) => c.slug).sort()).toEqual([...MOOD_SLUGS].sort());
  });

  it('excludes taxonomic collections below the 30-book threshold from genres', async () => {
    const db = fullHubDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/hub' });
    const body = res.json();

    const genreSlugs = body.genres.map((g: { slug: string }) => g.slug);
    expect(genreSlugs).toContain('genre-a');
    expect(genreSlugs).toContain('genre-b');
    expect(genreSlugs).not.toContain('genre-thin');
  });

  it('collection DTOs expose the required fields (id, slug, type, name, description, bookCount, updatedAt, isActive)', async () => {
    const db = fullHubDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/hub' });
    const body = res.json();

    const featuredCollection = body.featured.collection;
    expect(featuredCollection).toMatchObject({
      id: expect.any(String),
      slug: FEATURED_SLUG,
      type: 'editorial',
      name: expect.any(String),
      description: expect.any(String),
      bookCount: 4,
      isActive: true,
    });
    expect(typeof featuredCollection.updatedAt).toBe('string');
    expect(new Date(featuredCollection.updatedAt).toString()).not.toBe('Invalid Date');
  });

  it('book cards expose wishlistCount computed from wishlist_items', async () => {
    const db = fullHubDb();
    db.wishlistItems.push(
      { userId: 'u1', canonicalBookId: 'fb1' },
      { userId: 'u2', canonicalBookId: 'fb1' },
    );
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/hub' });
    const body = res.json();
    const fb1 = body.featured.previewBooks.find((b: { id: string }) => b.id === 'fb1');
    expect(fb1.wishlistCount).toBe(2);
  });
});
