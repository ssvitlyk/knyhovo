/**
 * W10.4 HTTP-based WishlistTargetFetcher.
 *
 * Uses plain HTTP (FetchHtmlFetcher) by default to fetch a single product page
 * and delegates parsing to the provider-specific single-product parser.
 *
 * NOTE: Cloudflare-protected providers (Yakaboo, Book-Ye) require a Playwright-based
 * fetcher in production. Playwright wiring is deferred to W10.4.x/W10.6 — plain
 * FetchHtmlFetcher will be blocked by Cloudflare on live URLs for those providers.
 */

import { SINGLE_PRODUCT_PARSERS, FetchHtmlFetcher } from '@knyhovo/scrapers';
import type { HtmlFetcher, SingleProductParser } from '@knyhovo/scrapers';
import type { ProviderName } from '@knyhovo/shared';
import type { WishlistTargetFetcher } from './wishlist.refresh.js';
import type { RefreshTarget } from './refresh-targets.js';
import type { RefreshedListingState } from './events.js';
import { mapAvailability } from '../pipeline/persist-listing.js';

// ---------------------------------------------------------------------------
// Reverse lookup: Prisma Provider enum → ProviderName
// ---------------------------------------------------------------------------

// PROVIDER_NAME_MAP in persist-listing.ts is ProviderName → Provider enum string.
// We build the inverse once at module load to avoid importing the full map
// and to keep this module self-contained.
const PROVIDER_ENUM_TO_NAME: Partial<Record<string, ProviderName>> = {
  YAKABOO: 'yakaboo',
  BOOK_CLUB: 'book-club',
  VIVAT: 'vivat',
  BOOK_YE: 'book-ye',
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class HttpTargetFetcher implements WishlistTargetFetcher {
  constructor(
    private readonly htmlFetcher: HtmlFetcher = new FetchHtmlFetcher(),
    private readonly parsers: Partial<Record<ProviderName, SingleProductParser>> = SINGLE_PRODUCT_PARSERS,
  ) {}

  async fetchTarget(
    target: RefreshTarget,
    opts: { readonly timeoutMs: number },
  ): Promise<RefreshedListingState> {
    const providerName = PROVIDER_ENUM_TO_NAME[target.provider as string];
    if (providerName === undefined) {
      throw new Error(`no single-product parser for provider ${target.provider}`);
    }

    const parser = this.parsers[providerName];
    if (parser === undefined) {
      throw new Error(`no single-product parser for provider ${target.provider}`);
    }

    // May throw (network error, HTTP 429/503 etc.) — propagates so the orchestrator's
    // isRateLimited stop-on-429/503 logic fires correctly.
    const html = await this.htmlFetcher.fetch(target.url, opts.timeoutMs);

    const parsed = parser(html);

    // Total parse miss: both price and availability are unknown — treat as gone
    // (non-destructive; keeps prior state in DB).
    if (parsed.price == null && parsed.availability === 'unknown') {
      return { kind: 'gone' };
    }

    return {
      kind: 'fetched',
      priceAmount: parsed.price?.amount ?? null,
      availability: mapAvailability(parsed.availability),
    };
  }
}
