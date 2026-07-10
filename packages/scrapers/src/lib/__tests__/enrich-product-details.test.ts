import { describe, it, expect } from 'vitest';
import type { RawProviderListing } from '@knyhovo/shared';
import type { HtmlFetcher } from '../../http/html-fetcher.js';
import {
  enrichProductDetails,
  isRateLimited,
  type ExtractedProductDetails,
} from '../enrich-product-details.js';

function listing(url: string, overrides: Partial<RawProviderListing> = {}): RawProviderListing {
  return {
    provider: 'yakaboo',
    title: 'Книга',
    author: null,
    isbn: null,
    price: { amount: 10000, currency: 'UAH' },
    url,
    availability: 'in-stock',
    ...overrides,
  };
}

/** Fetcher backed by a url→html map; a value that is an Error is thrown. */
class MapFetcher implements HtmlFetcher {
  readonly calls: string[] = [];
  constructor(private readonly responses: Record<string, string | Error>) {}
  async fetch(url: string): Promise<string> {
    this.calls.push(url);
    const r = this.responses[url];
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error(`no fixture for ${url}`);
    return r;
  }
}

// A trivial extractor: the fetched html IS the raw description fragment, no metadata.
const echoExtract = (html: string): ExtractedProductDetails => ({
  description: html.trim() === '' ? null : html,
  metadata: null,
});

describe('isRateLimited', () => {
  it('detects 429 and 503 in error messages', () => {
    expect(isRateLimited(new Error('HTTP 429 Too Many Requests'))).toBe(true);
    expect(isRateLimited(new Error('HTTP 503 Service Unavailable'))).toBe(true);
  });
  it('is false for other errors', () => {
    expect(isRateLimited(new Error('HTTP 404 Not Found'))).toBe(false);
    expect(isRateLimited(new Error('network timeout'))).toBe(false);
  });
});

describe('enrichProductDetails — description-only behavior (ported from enrichDescriptions)', () => {
  it('writes a sanitized description back onto each listing', async () => {
    const listings = [listing('https://a'), listing('https://b')];
    const fetcher = new MapFetcher({
      'https://a': '<p>Опис A</p>',
      'https://b': '<p>Опис B</p>',
    });
    const errors: string[] = [];

    await enrichProductDetails(listings, fetcher, echoExtract, { timeoutMs: 1000, delayMs: 0, errors });

    expect(listings[0]!.description).toBe('Опис A');
    expect(listings[1]!.description).toBe('Опис B');
    expect(errors).toEqual([]);
  });

  it('leaves description unset when the page has none, without failing the pass', async () => {
    const listings = [listing('https://a'), listing('https://b')];
    const fetcher = new MapFetcher({ 'https://a': '<p>Опис A</p>', 'https://b': '' });
    const errors: string[] = [];

    await enrichProductDetails(listings, fetcher, echoExtract, { timeoutMs: 1000, delayMs: 0, errors });

    expect(listings[0]!.description).toBe('Опис A');
    expect(listings[1]!.description).toBeUndefined();
    expect(errors).toEqual([]);
  });

  it('collects a per-listing fetch error and continues with the rest', async () => {
    const listings = [listing('https://a'), listing('https://b')];
    const fetcher = new MapFetcher({
      'https://a': new Error('HTTP 404 Not Found'),
      'https://b': '<p>Опис B</p>',
    });
    const errors: string[] = [];

    await enrichProductDetails(listings, fetcher, echoExtract, { timeoutMs: 1000, delayMs: 0, errors });

    expect(listings[0]!.description).toBeUndefined();
    expect(listings[1]!.description).toBe('Опис B');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('https://a');
  });

  it('stops the pass on a 429/503 and keeps already-enriched listings', async () => {
    const listings = [listing('https://a'), listing('https://b'), listing('https://c')];
    const fetcher = new MapFetcher({
      'https://a': '<p>Опис A</p>',
      'https://b': new Error('HTTP 503 Service Unavailable'),
      'https://c': '<p>Опис C</p>',
    });
    const errors: string[] = [];

    await enrichProductDetails(listings, fetcher, echoExtract, { timeoutMs: 1000, delayMs: 0, errors });

    expect(listings[0]!.description).toBe('Опис A');
    expect(listings[1]!.description).toBeUndefined();
    expect(listings[2]!.description).toBeUndefined();
    // c was never fetched — the pass stopped at the rate-limit.
    expect(fetcher.calls).toEqual(['https://a', 'https://b']);
    expect(errors).toHaveLength(1);
  });

  it('logs start, a line before every fetch, and a final summary', async () => {
    const listings = [listing('https://a'), listing('https://b')];
    const fetcher = new MapFetcher({ 'https://a': '<p>A</p>', 'https://b': '' });
    const lines: string[] = [];

    await enrichProductDetails(listings, fetcher, echoExtract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
      logger: { info: (m) => lines.push(m) },
    });

    expect(lines[0]).toBe('product enrichment: starting for 2 listings (delayMs=0)');
    expect(lines).toContain('product enrichment [1/2]: fetching https://a');
    expect(lines).toContain('product enrichment [2/2]: fetching https://b');
    expect(lines.at(-1)).toBe(
      'product enrichment: done — 1/2 listings enriched (0 skipped as already enriched), 0 errors',
    );
  });

  it('logs a progress line every 100 listings', async () => {
    const listings = Array.from({ length: 150 }, (_, i) => listing(`https://p/${i}`));
    const fetcher: HtmlFetcher = { fetch: async () => '<p>x</p>' };
    const lines: string[] = [];

    await enrichProductDetails(listings, fetcher, echoExtract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
      logger: { info: (m) => lines.push(m) },
    });

    expect(lines).toContain(
      'product enrichment: progress 100/150 (enriched=100, skipped=0, errors=0)',
    );
    expect(lines.filter((l) => l.includes('progress'))).toHaveLength(1);
  });

  it('skips listings that already carry a description — no fetch (default skipListing)', async () => {
    const enrichedListing: RawProviderListing = { ...listing('https://a'), description: 'Вже є' };
    const listings = [enrichedListing, listing('https://b')];
    const fetcher = new MapFetcher({ 'https://b': '<p>B</p>' });

    await enrichProductDetails(listings, fetcher, echoExtract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
    });

    expect(fetcher.calls).toEqual(['https://b']);
    expect(listings[0]!.description).toBe('Вже є');
    expect(listings[1]!.description).toBe('B');
  });

  it('skips URLs from skipUrls (already enriched in a previous run) — no fetch', async () => {
    const listings = [listing('https://a'), listing('https://b')];
    const fetcher = new MapFetcher({ 'https://b': '<p>B</p>' });
    const lines: string[] = [];

    await enrichProductDetails(listings, fetcher, echoExtract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
      skipUrls: new Set(['https://a']),
      logger: { info: (m) => lines.push(m) },
    });

    expect(fetcher.calls).toEqual(['https://b']);
    expect(listings[0]!.description).toBeUndefined();
    expect(lines.at(-1)).toBe(
      'product enrichment: done — 1/2 listings enriched (1 skipped as already enriched), 0 errors',
    );
  });

  it('logs the early stop when rate-limited', async () => {
    const listings = [listing('https://a'), listing('https://b')];
    const fetcher = new MapFetcher({ 'https://a': new Error('HTTP 429 Too Many Requests') });
    const lines: string[] = [];

    await enrichProductDetails(listings, fetcher, echoExtract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
      logger: { info: (m) => lines.push(m) },
    });

    expect(lines).toContain(
      'product enrichment: stopping early at 1/2 (rate-limited); 0 listings enriched',
    );
  });
});

describe('enrichProductDetails — metadata merge (book-metadata PRD)', () => {
  it('merges usable metadata fields onto the listing', async () => {
    const listings = [listing('https://a')];
    const fetcher = new MapFetcher({ 'https://a': 'html' });
    const extract = (): ExtractedProductDetails => ({
      description: null,
      metadata: {
        publisher: 'Vivat',
        language: 'Українська',
        format: 'Тверда',
        series: 'Навіки Токіо',
        publicationYear: 2023,
      },
    });

    await enrichProductDetails(listings, fetcher, extract, { timeoutMs: 1000, delayMs: 0, errors: [] });

    expect(listings[0]).toMatchObject({
      publisher: 'Vivat',
      language: 'Українська',
      format: 'Тверда',
      series: 'Навіки Токіо',
      publicationYear: 2023,
    });
  });

  it('fills isbn only when the listing isbn is currently null/empty', async () => {
    const withIsbn = listing('https://a', { isbn: '9780000000002' });
    const withoutIsbn = listing('https://b', { isbn: null });
    const listings = [withIsbn, withoutIsbn];
    const fetcher = new MapFetcher({ 'https://a': 'html', 'https://b': 'html' });
    const extract = (): ExtractedProductDetails => ({
      description: null,
      metadata: { isbn: '9789669829283' },
    });

    await enrichProductDetails(listings, fetcher, extract, { timeoutMs: 1000, delayMs: 0, errors: [] });

    // Existing catalog ISBN is never overwritten.
    expect(listings[0]!.isbn).toBe('9780000000002');
    // Null ISBN is filled from the product page.
    expect(listings[1]!.isbn).toBe('9789669829283');
  });

  it('applies each metadata field independently — unusable fields stay null', async () => {
    const listings = [listing('https://a')];
    const fetcher = new MapFetcher({ 'https://a': 'html' });
    const extract = (): ExtractedProductDetails => ({
      description: null,
      metadata: { publisher: 'Vivat', language: null, format: '', publicationYear: undefined },
    });

    await enrichProductDetails(listings, fetcher, extract, { timeoutMs: 1000, delayMs: 0, errors: [] });

    expect(listings[0]!.publisher).toBe('Vivat');
    expect(listings[0]!.language).toBeUndefined();
    expect(listings[0]!.format).toBeUndefined();
    expect(listings[0]!.publicationYear).toBeUndefined();
  });

  it('counts a listing as enriched when only metadata (no description) changed', async () => {
    const listings = [listing('https://a')];
    const fetcher = new MapFetcher({ 'https://a': 'html' });
    const extract = (): ExtractedProductDetails => ({
      description: null,
      metadata: { publisher: 'Vivat' },
    });
    const lines: string[] = [];

    await enrichProductDetails(listings, fetcher, extract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
      logger: { info: (m) => lines.push(m) },
    });

    expect(lines.at(-1)).toBe(
      'product enrichment: done — 1/1 listings enriched (0 skipped as already enriched), 0 errors',
    );
  });

  it('leaves the listing untouched when metadata is null (description-only provider)', async () => {
    const listings = [listing('https://a')];
    const fetcher = new MapFetcher({ 'https://a': 'html' });
    const extract = (): ExtractedProductDetails => ({ description: null, metadata: null });

    await enrichProductDetails(listings, fetcher, extract, { timeoutMs: 1000, delayMs: 0, errors: [] });

    expect(listings[0]!.publisher).toBeUndefined();
  });

  it('custom skipListing predicate: skips only when its condition is met', async () => {
    const alreadyFull = listing('https://a', { description: 'Опис', publisher: 'Vivat' });
    const descOnly = listing('https://b', { description: 'Опис' });
    const listings = [alreadyFull, descOnly];
    const fetcher = new MapFetcher({ 'https://b': 'html' });
    const extract = (): ExtractedProductDetails => ({
      description: null,
      metadata: { publisher: 'Vivat' },
    });

    await enrichProductDetails(listings, fetcher, extract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
      skipListing: (l) => l.description != null && l.description !== '' && l.publisher != null,
    });

    // alreadyFull skipped without fetch; descOnly re-fetched to backfill metadata.
    expect(fetcher.calls).toEqual(['https://b']);
    expect(listings[1]!.publisher).toBe('Vivat');
  });
});
