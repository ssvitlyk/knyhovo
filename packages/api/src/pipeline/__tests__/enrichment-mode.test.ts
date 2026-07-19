import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { ScraperOptions, ScraperProvider, ScraperResult } from '@knyhovo/shared';
import { resolveProviderScraperOptions, runScrapePipeline } from '../run-scrape.js';

/**
 * enrichmentMode capability tests (megakniga-resumable-enrichment PRD §4.1,
 * test matrix row 1): a 'background' provider never receives the inline
 * `enrichDescriptions` flag from the pipeline — its details are filled by the
 * separate `scrape:enrich` job — while 'inline' providers (all existing ones)
 * keep the exact pre-capability behavior. No provider-name checks anywhere:
 * the decision comes from the provider's own declaration.
 */

class FakeScraper implements ScraperProvider {
  lastOptions?: ScraperOptions;

  constructor(
    readonly name: ScraperProvider['name'],
    readonly enrichmentMode?: ScraperProvider['enrichmentMode'],
  ) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    if (options !== undefined) this.lastOptions = options;
    return {
      provider: this.name,
      listings: [],
      scrapedAt: '2026-01-01T00:00:00.000Z',
      errors: [],
    };
  }
}

function makeLogSink(): { logger: { info: (m: string) => void; error: (m: string) => void }; lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    logger: {
      info: (m: string) => {
        lines.push(m);
      },
      error: (m: string) => {
        lines.push(m);
      },
    },
  };
}

describe('resolveProviderScraperOptions', () => {
  const enrichOptions: ScraperOptions = {
    enrichDescriptions: true,
    descriptionDelayMs: 500,
    skipDescriptionUrls: new Set(['https://x/1']),
    maxPages: 3,
    delayMs: 100,
  };

  it('strips the inline enrichment knobs for a background provider and logs the redirect', () => {
    const { logger, lines } = makeLogSink();
    const resolved = resolveProviderScraperOptions(
      { name: 'megakniga', enrichmentMode: 'background' },
      enrichOptions,
      logger,
    );
    expect(resolved).toEqual({ maxPages: 3, delayMs: 100 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('enrichmentMode=background');
    expect(lines[0]).toContain('scrape:enrich -- --provider=megakniga');
  });

  it('passes options through untouched for an inline provider', () => {
    const { logger, lines } = makeLogSink();
    const resolved = resolveProviderScraperOptions(
      { name: 'vivat', enrichmentMode: 'inline' },
      enrichOptions,
      logger,
    );
    expect(resolved).toBe(enrichOptions);
    expect(lines).toHaveLength(0);
  });

  it('treats a provider without the capability as inline (default)', () => {
    const { logger } = makeLogSink();
    const resolved = resolveProviderScraperOptions({ name: 'yakaboo' }, enrichOptions, logger);
    expect(resolved).toBe(enrichOptions);
  });

  it('does nothing when enrichment is off, regardless of mode', () => {
    const { logger, lines } = makeLogSink();
    const options: ScraperOptions = { maxPages: 2 };
    expect(
      resolveProviderScraperOptions(
        { name: 'megakniga', enrichmentMode: 'background' },
        options,
        logger,
      ),
    ).toBe(options);
    expect(
      resolveProviderScraperOptions(
        { name: 'megakniga', enrichmentMode: 'background' },
        undefined,
        logger,
      ),
    ).toBeUndefined();
    expect(lines).toHaveLength(0);
  });
});

describe('runScrapePipeline with enrichmentMode', () => {
  function makeMinimalPrisma(): {
    prisma: PrismaClient;
    listingFindMany: ReturnType<typeof vi.fn>;
  } {
    const listingFindMany = vi.fn(async () => []);
    const fake = {
      canonicalBook: { findMany: vi.fn(async () => []) },
      providerListing: { findMany: listingFindMany },
    };
    return { prisma: fake as unknown as PrismaClient, listingFindMany };
  }

  it('background provider: scrape() runs without enrichDescriptions and the skip-set query is skipped', async () => {
    const { prisma, listingFindMany } = makeMinimalPrisma();
    const provider = new FakeScraper('megakniga', 'background');
    const { logger, lines } = makeLogSink();

    await runScrapePipeline({
      prisma,
      providers: [provider],
      scraperOptions: { enrichDescriptions: true, descriptionDelayMs: 250, maxPages: 1 },
      logger,
    });

    expect(provider.lastOptions?.enrichDescriptions).toBeUndefined();
    expect(provider.lastOptions?.descriptionDelayMs).toBeUndefined();
    expect(provider.lastOptions?.maxPages).toBe(1);
    // No "already enriched" skip-set lookup for a background provider.
    expect(listingFindMany).not.toHaveBeenCalled();
    expect(lines.some((l) => l.includes('inline enrichment skipped'))).toBe(true);
  });

  it('inline provider: enrichDescriptions passes through and the skip-set query still runs', async () => {
    const { prisma, listingFindMany } = makeMinimalPrisma();
    const provider = new FakeScraper('vivat', 'inline');
    const { logger } = makeLogSink();

    await runScrapePipeline({
      prisma,
      providers: [provider],
      scraperOptions: { enrichDescriptions: true, maxPages: 1 },
      logger,
    });

    expect(provider.lastOptions?.enrichDescriptions).toBe(true);
    expect(listingFindMany).toHaveBeenCalledTimes(1);
  });
});
