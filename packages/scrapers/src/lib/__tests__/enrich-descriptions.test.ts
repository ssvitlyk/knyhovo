import { describe, it, expect } from 'vitest';
import type { RawProviderListing } from '@knyhovo/shared';
import type { HtmlFetcher } from '../../http/html-fetcher.js';
import { enrichDescriptions, isRateLimited } from '../enrich-descriptions.js';

function listing(url: string): RawProviderListing {
  return {
    provider: 'yakaboo',
    title: 'Книга',
    author: null,
    isbn: null,
    price: { amount: 10000, currency: 'UAH' },
    url,
    availability: 'in-stock',
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

// A trivial extractor: the fetched html IS the raw description fragment.
const echoExtract = (html: string): string | null => (html.trim() === '' ? null : html);

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

describe('enrichDescriptions', () => {
  it('writes a sanitized description back onto each listing', async () => {
    const listings = [listing('https://a'), listing('https://b')];
    const fetcher = new MapFetcher({
      'https://a': '<p>Опис A</p>',
      'https://b': '<p>Опис B</p>',
    });
    const errors: string[] = [];

    await enrichDescriptions(listings, fetcher, echoExtract, { timeoutMs: 1000, delayMs: 0, errors });

    expect(listings[0]!.description).toBe('Опис A');
    expect(listings[1]!.description).toBe('Опис B');
    expect(errors).toEqual([]);
  });

  it('leaves description unset when the page has none, without failing the pass', async () => {
    const listings = [listing('https://a'), listing('https://b')];
    const fetcher = new MapFetcher({ 'https://a': '<p>Опис A</p>', 'https://b': '' });
    const errors: string[] = [];

    await enrichDescriptions(listings, fetcher, echoExtract, { timeoutMs: 1000, delayMs: 0, errors });

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

    await enrichDescriptions(listings, fetcher, echoExtract, { timeoutMs: 1000, delayMs: 0, errors });

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

    await enrichDescriptions(listings, fetcher, echoExtract, { timeoutMs: 1000, delayMs: 0, errors });

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

    await enrichDescriptions(listings, fetcher, echoExtract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
      logger: { info: (m) => lines.push(m) },
    });

    expect(lines[0]).toBe('description enrichment: starting for 2 listings (delayMs=0)');
    expect(lines).toContain('description enrichment [1/2]: fetching https://a');
    expect(lines).toContain('description enrichment [2/2]: fetching https://b');
    expect(lines.at(-1)).toBe('description enrichment: done — 1/2 descriptions, 0 errors');
  });

  it('logs a progress line every 100 listings', async () => {
    const listings = Array.from({ length: 150 }, (_, i) => listing(`https://p/${i}`));
    const fetcher: HtmlFetcher = { fetch: async () => '<p>x</p>' };
    const lines: string[] = [];

    await enrichDescriptions(listings, fetcher, echoExtract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
      logger: { info: (m) => lines.push(m) },
    });

    expect(lines).toContain('description enrichment: progress 100/150 (descriptions=100, errors=0)');
    expect(lines.filter((l) => l.includes('progress'))).toHaveLength(1);
  });

  it('logs the early stop when rate-limited', async () => {
    const listings = [listing('https://a'), listing('https://b')];
    const fetcher = new MapFetcher({ 'https://a': new Error('HTTP 429 Too Many Requests') });
    const lines: string[] = [];

    await enrichDescriptions(listings, fetcher, echoExtract, {
      timeoutMs: 1000,
      delayMs: 0,
      errors: [],
      logger: { info: (m) => lines.push(m) },
    });

    expect(lines).toContain(
      'description enrichment: stopping early at 1/2 (rate-limited); 0 descriptions kept',
    );
  });
});
