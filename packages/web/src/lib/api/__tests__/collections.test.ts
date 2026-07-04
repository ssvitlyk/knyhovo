import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CollectionsError,
  getCollection,
  getCollectionBooks,
  getCollectionsHub,
  listCollections,
} from '../collections';
import type { CollectionDto } from '../types';

const COLLECTION: CollectionDto = {
  id: 'c1',
  slug: 'znyzhky',
  type: 'dynamic',
  name: 'Найбільші знижки',
  description: 'Найбільші цінові падіння цього тижня.',
  bookCount: 42,
  updatedAt: '2026-07-04T00:00:00.000Z',
  isActive: true,
};

function mockFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCollectionsHub', () => {
  it('requests /api/collections/hub and returns the parsed body', async () => {
    let calledUrl = '';
    const hub = { featured: { collection: COLLECTION, previewBooks: [] }, dynamic: [], editorial: [], weekly: [], moods: [], genres: [] };
    mockFetch((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(JSON.stringify(hub), { status: 200 });
    }) as typeof fetch);

    const result = await getCollectionsHub();
    expect(result).toEqual(hub);
    expect(calledUrl).toContain('/api/collections/hub');
  });
});

describe('getCollection', () => {
  it('returns the collection on 200', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ collection: COLLECTION }), { status: 200 })) as typeof fetch);
    const result = await getCollection('znyzhky');
    expect(result).toEqual({ collection: COLLECTION });
  });

  it('signals redirectedToHub on a 301 (thin genre)', async () => {
    mockFetch((async () => new Response(null, { status: 301 })) as typeof fetch);
    const result = await getCollection('tonkyi-zhanr');
    expect(result).toEqual({ redirectedToHub: true });
  });

  it('throws CollectionsError with the envelope code on 404', async () => {
    mockFetch((async () =>
      new Response(
        JSON.stringify({ error: { code: 'COLLECTION_NOT_FOUND', message: 'Добірку не знайдено.' } }),
        { status: 404 },
      )) as typeof fetch);

    const error = await getCollection('nope').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CollectionsError);
    expect((error as CollectionsError).status).toBe(404);
    expect((error as CollectionsError).code).toBe('COLLECTION_NOT_FOUND');
  });
});

describe('getCollectionBooks', () => {
  it('sends page/per_page/sort and returns the page payload', async () => {
    let calledUrl = '';
    const page = { books: [], total: 0, page: 2, per_page: 24, total_pages: 0 };
    mockFetch((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(JSON.stringify(page), { status: 200 });
    }) as typeof fetch);

    const result = await getCollectionBooks({ slug: 'znyzhky', page: 2, sort: 'oldest' });
    expect(result).toEqual(page);
    expect(calledUrl).toContain('/api/collections/znyzhky/books?');
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('per_page=24');
    expect(calledUrl).toContain('sort=oldest');
  });

  it('throws CollectionsError with null status on a transport failure', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const error = await getCollectionBooks({ slug: 'znyzhky' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CollectionsError);
    expect((error as CollectionsError).status).toBeNull();
  });
});

describe('listCollections', () => {
  it('returns all collections', async () => {
    mockFetch((async () =>
      new Response(JSON.stringify({ collections: [COLLECTION] }), { status: 200 })) as typeof fetch);
    const result = await listCollections();
    expect(result.collections).toHaveLength(1);
  });
});
