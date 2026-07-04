import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { clearCache } from '../cache.js';
import { emptyDb, makeFakePrisma, book, listing, collection } from './fake-prisma.js';

async function buildTestApp(db: ReturnType<typeof emptyDb>) {
  const prisma = makeFakePrisma(db);
  return buildApp(prisma);
}

describe('GET /api/collections/:slug', () => {
  beforeEach(() => {
    clearCache();
  });

  it('returns 404 COLLECTION_NOT_FOUND for an unknown slug', async () => {
    const db = emptyDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'COLLECTION_NOT_FOUND', message: expect.any(String) } });
  });

  it('returns collection detail for a known editorial slug', async () => {
    const db = emptyDb();
    const c = collection('col-1', 'buker-2026', 'EDITORIAL', { name: 'Букерівський список', displayOrder: 1 });
    db.collections.push(c);
    db.books.push(book('b1', 'Book', 'Author', { listings: [listing(10000)] }));
    db.collectionItems.push({ collectionId: c.id, canonicalBookId: 'b1', sortOrder: 0 });

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/buker-2026' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      collection: expect.objectContaining({ slug: 'buker-2026', type: 'editorial', name: 'Букерівський список', bookCount: 1 }),
    });
  });

  it('returns 301 with Location: /dobirky for a taxonomic collection below 30 books', async () => {
    const db = emptyDb();
    const thin = collection('genre-thin', 'thin-genre', 'TAXONOMIC', { displayOrder: 1 });
    db.collections.push(thin);
    for (let i = 0; i < 10; i += 1) {
      db.books.push(book(`t${i}`, `Book ${i}`, 'Author', { genreId: thin.id, listings: [listing(5000)] }));
    }

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/thin-genre' });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/dobirky');
  });

  it('returns 200 (not a redirect) for a taxonomic collection at/above 30 books', async () => {
    const db = emptyDb();
    const eligible = collection('genre-ok', 'ok-genre', 'TAXONOMIC', { displayOrder: 1 });
    db.collections.push(eligible);
    for (let i = 0; i < 30; i += 1) {
      db.books.push(book(`o${i}`, `Book ${i}`, 'Author', { genreId: eligible.id, listings: [listing(5000)] }));
    }

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/ok-genre' });
    expect(res.statusCode).toBe(200);
    expect(res.json().collection.bookCount).toBe(30);
  });
});

describe('GET /api/collections', () => {
  beforeEach(() => {
    clearCache();
  });

  it('returns all active collections, including thin genres, sorted by type then displayOrder', async () => {
    const db = emptyDb();
    db.collections.push(
      collection('c-dyn-2', 'dyn-2', 'DYNAMIC', { displayOrder: 2 }),
      collection('c-dyn-1', 'dyn-1', 'DYNAMIC', { displayOrder: 1 }),
      collection('c-edit-1', 'edit-1', 'EDITORIAL', { displayOrder: 1 }),
      collection('c-tax-thin', 'tax-thin', 'TAXONOMIC', { displayOrder: 1 }),
    );
    db.books.push(book('b-thin', 'Thin Book', 'Author', { genreId: 'c-tax-thin', listings: [listing(5000)] }));

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const slugs = body.collections.map((c: { slug: string }) => c.slug);
    // DYNAMIC < EDITORIAL < TAXONOMIC alphabetically; within a type, displayOrder ascending.
    expect(slugs).toEqual(['dyn-1', 'dyn-2', 'edit-1', 'tax-thin']);
  });

  it('excludes inactive collections', async () => {
    const db = emptyDb();
    db.collections.push(
      collection('c1', 'active-one', 'EDITORIAL', { displayOrder: 1, isActive: true }),
      collection('c2', 'inactive-one', 'EDITORIAL', { displayOrder: 2, isActive: false }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections' });
    const body = res.json();
    const slugs = body.collections.map((c: { slug: string }) => c.slug);
    expect(slugs).toEqual(['active-one']);
  });
});
