import type { ScraperProvider, ScraperResult, ScraperOptions, RawProviderListing } from '@knyhovo/shared';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CATALOG_PER_PAGE,
  DEFAULT_DELAY_MS,
  DEFAULT_MAX_PRODUCTS,
  DEFAULT_TIMEOUT_MS,
  buildCatalogProductsQuery,
  buildProductPageBatchQuery,
} from './constants.js';
import { HttpGraphqlClient, type GraphqlClient } from './graphql-client.js';
import { parseCatalogProducts, parseProductPageBatch } from './book-club.parser.js';

/**
 * BookClub (КСД) scraper — the project's first API-based (GraphQL) provider.
 *
 * Discovery phase: paginates `catalogProducts(format:paper)` to collect slugs.
 * Enrichment phase: chunks slugs into alias-batches of `productPage` queries
 * (up to `batchSize` per request) to fetch full product details.
 *
 * The `GraphqlClient` is fully injectable so tests can drive all code paths
 * without network I/O. All errors are collected in `errors[]`; `scrape` never
 * throws.
 */
export class BookClubScraper implements ScraperProvider {
  readonly name = 'book-club' as const;

  constructor(
    private readonly client: GraphqlClient = new HttpGraphqlClient(),
    private readonly maxProducts: number = DEFAULT_MAX_PRODUCTS,
    private readonly batchSize: number = DEFAULT_BATCH_SIZE,
  ) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxProducts = options?.maxPages ?? this.maxProducts;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;

    const allListings: RawProviderListing[] = [];
    const errors: string[] = [];
    const seenSlugs = new Set<string>();
    const slugs: string[] = [];

    // ── Discovery ──────────────────────────────────────────────────────────
    let page = 1;

    while (true) {
      let response;
      try {
        response = await this.client.request(
          buildCatalogProductsQuery(page, DEFAULT_CATALOG_PER_PAGE),
          undefined,
          timeoutMs,
        );
      } catch (err) {
        errors.push(
          `Catalog page ${page}: network error — ${err instanceof Error ? err.message : String(err)}`,
        );
        break;
      }

      const { slugs: newSlugs, hasMorePages, errors: parseErrors } = parseCatalogProducts(response);
      errors.push(...parseErrors);

      // Guard: stop if a page returned no new slugs (avoids infinite loop)
      let addedAny = false;
      for (const slug of newSlugs) {
        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          slugs.push(slug);
          addedAny = true;
        }
      }

      if (!addedAny || !hasMorePages || slugs.length >= maxProducts) break;

      page++;
      if (delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // ── Cap ────────────────────────────────────────────────────────────────
    const targets = slugs.slice(0, maxProducts);

    // ── Enrichment ─────────────────────────────────────────────────────────
    const seenUrls = new Set<string>();

    for (let i = 0; i < targets.length; i += this.batchSize) {
      const batch = targets.slice(i, i + this.batchSize);

      let response;
      try {
        response = await this.client.request(
          buildProductPageBatchQuery(batch),
          undefined,
          timeoutMs,
        );
      } catch (err) {
        errors.push(
          `Batch [${batch[0]}...]: fetch error — ${err instanceof Error ? err.message : String(err)}`,
        );
        if (i + this.batchSize < targets.length && delayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        }
        continue;
      }

      const { listings, errors: batchErrors } = parseProductPageBatch(response, batch);
      errors.push(...batchErrors);

      for (const listing of listings) {
        if (!seenUrls.has(listing.url)) {
          seenUrls.add(listing.url);
          allListings.push(listing);
        }
      }

      if (i + this.batchSize < targets.length && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { provider: 'book-club', listings: allListings, scrapedAt, errors };
  }
}
