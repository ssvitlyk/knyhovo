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
});
