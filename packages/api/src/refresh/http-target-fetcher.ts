/**
 * W10.4/W10.6 HTTP-based WishlistTargetFetcher.
 *
 * Fetches a single product page and delegates parsing to the provider-specific
 * single-product parser. When no explicit HtmlFetcher is supplied (production
 * default), the fetcher is resolved per-provider through the centralized
 * fetcher-registry: Cloudflare-protected providers (Yakaboo, Book-Ye) are
 * routed through PlaywrightHtmlFetcher; server-rendered providers (Vivat,
 * Book-Club) use the lighter FetchHtmlFetcher.
 */

import { SINGLE_PRODUCT_PARSERS } from '@knyhovo/scrapers';
import type { HtmlFetcher, SingleProductParser } from '@knyhovo/scrapers';
import { resolveTargetFetcher } from './fetcher-registry.js';
import type { ProviderName } from '@knyhovo/shared';
import type { WishlistTargetFetcher } from './wishlist.refresh.js';
import type { RefreshTarget } from './refresh-targets.js';
import type { RefreshedListingState } from './events.js';
import { mapAvailability } from '../pipeline/persist-listing.js';
import { PROVIDER_SLUG } from '../pricing/provider-maps.js';

// Providers with a single-product refresh path. Intentionally a subset of all
// providers: anything else is rejected as "no single-product parser".
const SINGLE_PRODUCT_PROVIDERS: ReadonlySet<ProviderName> = new Set<ProviderName>([
  'yakaboo',
  'book-club',
  'vivat',
  'book-ye',
]);

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class HttpTargetFetcher implements WishlistTargetFetcher {
  /**
   * @param htmlFetcher - Optional override for all providers. When omitted (production
   *   default), each provider is routed to the appropriate fetcher via the registry.
   *   Pass an explicit fetcher in tests to keep routing deterministic.
   * @param parsers - Single-product parsers keyed by ProviderName (default: all known parsers).
   */
  constructor(
    private readonly htmlFetcher: HtmlFetcher | null = null,
    private readonly parsers: Partial<Record<ProviderName, SingleProductParser>> = SINGLE_PRODUCT_PARSERS,
  ) {}

  async fetchTarget(
    target: RefreshTarget,
    opts: { readonly timeoutMs: number },
  ): Promise<RefreshedListingState> {
    const providerName = PROVIDER_SLUG[target.provider];
    if (!SINGLE_PRODUCT_PROVIDERS.has(providerName)) {
      throw new Error(`no single-product parser for provider ${target.provider}`);
    }

    const parser = this.parsers[providerName];
    if (parser === undefined) {
      throw new Error(`no single-product parser for provider ${target.provider}`);
    }

    // May throw (network error, HTTP 429/503 etc.) — propagates so the orchestrator's
    // isRateLimited stop-on-429/503 logic fires correctly.
    const fetcher = this.htmlFetcher ?? resolveTargetFetcher(providerName);
    const html = await fetcher.fetch(target.url, opts.timeoutMs);

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
