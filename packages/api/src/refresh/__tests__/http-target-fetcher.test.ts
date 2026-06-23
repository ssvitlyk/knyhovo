import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider, Availability } from '@prisma/client';
import { HttpTargetFetcher } from '../http-target-fetcher.js';
import type { HtmlFetcher, SingleProductParser, ParsedProductState } from '@knyhovo/scrapers';
import type { ProviderName } from '@knyhovo/shared';
import type { RefreshTarget } from '../refresh-targets.js';

// Mock the fetcher-registry module so tests that omit an explicit HtmlFetcher
// don't spin up a real Playwright browser.
vi.mock('../fetcher-registry.js', () => ({
  resolveTargetFetcher: vi.fn(),
}));

import { resolveTargetFetcher } from '../fetcher-registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');

function makeTarget(overrides?: Partial<RefreshTarget>): RefreshTarget {
  return {
    providerListingId: 'listing-1',
    canonicalBookId: 'book-1',
    provider: Provider.VIVAT,
    url: 'https://vivat.com.ua/product/123',
    currentPriceAmount: 10000,
    currentPriceCurrency: 'UAH',
    currentAvailability: Availability.IN_STOCK,
    lastSeenAt: FIXED_NOW,
    scope: { inWishlist: true, hasActiveAlert: false },
    ...overrides,
  };
}

/** Fake HtmlFetcher that returns canned HTML without touching the network. */
class FakeHtmlFetcher implements HtmlFetcher {
  constructor(private readonly html: string = '<html>fake</html>') {}
  async fetch(): Promise<string> {
    return this.html;
  }
}

/** FakeHtmlFetcher that throws on fetch. */
class ThrowingHtmlFetcher implements HtmlFetcher {
  constructor(private readonly err: Error) {}
  async fetch(): Promise<string> {
    throw this.err;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HttpTargetFetcher', () => {
  it('fetched-with-price: returns kind=fetched with priceAmount and IN_STOCK', async () => {
    const fakeParser: SingleProductParser = (): ParsedProductState => ({
      price: { amount: 7000, currency: 'UAH' },
      availability: 'in-stock',
    });
    const parsers: Partial<Record<ProviderName, SingleProductParser>> = { vivat: fakeParser };

    const fetcher = new HttpTargetFetcher(new FakeHtmlFetcher(), parsers);
    const result = await fetcher.fetchTarget(makeTarget(), { timeoutMs: 5000 });

    expect(result.kind).toBe('fetched');
    if (result.kind === 'fetched') {
      expect(result.priceAmount).toBe(7000);
      expect(result.availability).toBe('IN_STOCK');
    }
  });

  it('out-of-stock (null price): returns kind=fetched, priceAmount=null, OUT_OF_STOCK', async () => {
    const fakeParser: SingleProductParser = (): ParsedProductState => ({
      price: null,
      availability: 'out-of-stock',
    });
    const parsers: Partial<Record<ProviderName, SingleProductParser>> = { vivat: fakeParser };

    const fetcher = new HttpTargetFetcher(new FakeHtmlFetcher(), parsers);
    const result = await fetcher.fetchTarget(makeTarget(), { timeoutMs: 5000 });

    expect(result.kind).toBe('fetched');
    if (result.kind === 'fetched') {
      expect(result.priceAmount).toBeNull();
      expect(result.availability).toBe('OUT_OF_STOCK');
    }
  });

  it('total parse miss (null price + unknown availability) => returns kind=gone', async () => {
    const fakeParser: SingleProductParser = (): ParsedProductState => ({
      price: null,
      availability: 'unknown',
    });
    const parsers: Partial<Record<ProviderName, SingleProductParser>> = { vivat: fakeParser };

    const fetcher = new HttpTargetFetcher(new FakeHtmlFetcher(), parsers);
    const result = await fetcher.fetchTarget(makeTarget(), { timeoutMs: 5000 });

    expect(result.kind).toBe('gone');
  });

  it('fetch throw propagates so orchestrator can classify 429/503', async () => {
    const parsers: Partial<Record<ProviderName, SingleProductParser>> = {
      vivat: (): ParsedProductState => ({ price: null, availability: 'unknown' }),
    };
    const throwErr = new Error('HTTP 429 Too Many Requests');
    const fetcher = new HttpTargetFetcher(new ThrowingHtmlFetcher(throwErr), parsers);

    await expect(fetcher.fetchTarget(makeTarget(), { timeoutMs: 5000 })).rejects.toThrow(
      'HTTP 429 Too Many Requests',
    );
  });

  it('unknown provider (no parser) throws descriptive error', async () => {
    // BOOK_CLUB has no parser in SINGLE_PRODUCT_PARSERS — use an empty map to simulate.
    const parsers: Partial<Record<ProviderName, SingleProductParser>> = {};
    const fetcher = new HttpTargetFetcher(new FakeHtmlFetcher(), parsers);

    await expect(
      fetcher.fetchTarget(makeTarget({ provider: Provider.BOOK_CLUB }), { timeoutMs: 5000 }),
    ).rejects.toThrow(/no single-product parser for provider BOOK_CLUB/);
  });

  it('unknown Prisma provider enum value throws descriptive error', async () => {
    const parsers: Partial<Record<ProviderName, SingleProductParser>> = {};
    const fetcher = new HttpTargetFetcher(new FakeHtmlFetcher(), parsers);
    // Use a value that has no PROVIDER_ENUM_TO_NAME entry.
    const target = makeTarget({ provider: 'UNKNOWN_PROVIDER' as Provider });

    await expect(fetcher.fetchTarget(target, { timeoutMs: 5000 })).rejects.toThrow(
      /no single-product parser for provider UNKNOWN_PROVIDER/,
    );
  });
});

// ---------------------------------------------------------------------------
// Registry routing — when no explicit HtmlFetcher is supplied
// ---------------------------------------------------------------------------

describe('HttpTargetFetcher — registry routing (no explicit htmlFetcher)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes through the registry when no htmlFetcher is passed, and calls resolveTargetFetcher with the provider name', async () => {
    const fakeHtml = '<html>vivat product</html>';
    const fakeFetcher: HtmlFetcher = { fetch: vi.fn(async () => fakeHtml) };
    vi.mocked(resolveTargetFetcher).mockReturnValue(fakeFetcher);

    const fakeParser: SingleProductParser = (): ParsedProductState => ({
      price: { amount: 5000, currency: 'UAH' },
      availability: 'in-stock',
    });
    const parsers: Partial<Record<ProviderName, SingleProductParser>> = { vivat: fakeParser };

    // No explicit htmlFetcher passed → must consult registry
    const fetcher = new HttpTargetFetcher(null, parsers);
    const target = makeTarget({ provider: Provider.VIVAT });
    const result = await fetcher.fetchTarget(target, { timeoutMs: 5000 });

    // Registry must have been consulted with the correct provider name
    expect(vi.mocked(resolveTargetFetcher)).toHaveBeenCalledWith('vivat');
    expect(result.kind).toBe('fetched');
    if (result.kind === 'fetched') {
      expect(result.priceAmount).toBe(5000);
    }
  });

  it('uses the explicit htmlFetcher and does NOT consult the registry when one is provided', async () => {
    const explicitFetcher = new FakeHtmlFetcher('<html>explicit</html>');
    const fakeParser: SingleProductParser = (): ParsedProductState => ({
      price: { amount: 9000, currency: 'UAH' },
      availability: 'in-stock',
    });
    const parsers: Partial<Record<ProviderName, SingleProductParser>> = { vivat: fakeParser };

    const fetcher = new HttpTargetFetcher(explicitFetcher, parsers);
    const target = makeTarget({ provider: Provider.VIVAT });
    await fetcher.fetchTarget(target, { timeoutMs: 5000 });

    // Registry must NOT have been called
    expect(vi.mocked(resolveTargetFetcher)).not.toHaveBeenCalled();
  });
});
