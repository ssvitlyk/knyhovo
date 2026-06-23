/**
 * Centralized Provider→HtmlFetcher registry (W10.6).
 *
 * Routes each ProviderName to the appropriate HtmlFetcher implementation:
 * - Cloudflare-protected providers (yakaboo, book-ye) use PlaywrightHtmlFetcher.
 * - Server-rendered / unprotected providers (vivat, book-club) use FetchHtmlFetcher.
 *
 * Fetchers are lazy singletons: created on first use and reused across all refresh
 * cycles to avoid spinning up a new browser for each request. HTTP fetchers are
 * stateless, so a single shared instance is sufficient for all HTTP-based providers.
 *
 * Call `closeRegistryResources()` on process shutdown to cleanly close the shared
 * Playwright browser (no-op if Playwright was never used).
 */

import { FetchHtmlFetcher, PlaywrightHtmlFetcher, browserManager } from '@knyhovo/scrapers';
import type { HtmlFetcher } from '@knyhovo/scrapers';
import type { ProviderName } from '@knyhovo/shared';

// ---------------------------------------------------------------------------
// Lazy singletons
// ---------------------------------------------------------------------------

let _fetchFetcher: FetchHtmlFetcher | null = null;

function getFetchFetcher(): FetchHtmlFetcher {
  _fetchFetcher ??= new FetchHtmlFetcher();
  return _fetchFetcher;
}

// NOTE: Single-product-page content selectors for Yakaboo and Book-Ye are not
// yet verified against live pages (deferred W10.4/W10.6 — see memory note:
// "product-state selectors deferred"). Playwright fetchers therefore rely on
// the default networkidle strategy rather than a waitForSelector option.
let _yakabooFetcher: PlaywrightHtmlFetcher | null = null;
let _bookYeFetcher: PlaywrightHtmlFetcher | null = null;

function getYakabooFetcher(): PlaywrightHtmlFetcher {
  _yakabooFetcher ??= new PlaywrightHtmlFetcher(browserManager);
  return _yakabooFetcher;
}

function getBookYeFetcher(): PlaywrightHtmlFetcher {
  _bookYeFetcher ??= new PlaywrightHtmlFetcher(browserManager);
  return _bookYeFetcher;
}

// ---------------------------------------------------------------------------
// Typed exhaustive map — adding a ProviderName forces an update here
// ---------------------------------------------------------------------------

const FETCHER_FACTORY: Record<ProviderName, () => HtmlFetcher> = {
  yakaboo: getYakabooFetcher,
  'book-ye': getBookYeFetcher,
  vivat: getFetchFetcher,
  // book-club: no single-product parser yet; FetchHtmlFetcher kept for completeness
  'book-club': getFetchFetcher,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the HtmlFetcher registered for `provider`.
 *
 * Fetchers are lazy singletons: the instance is created on first call and
 * reused on subsequent calls. Throws if `provider` is not in the registry
 * (should only happen if ProviderName is extended without updating this file).
 */
export function resolveTargetFetcher(provider: ProviderName): HtmlFetcher {
  const factory = FETCHER_FACTORY[provider];
  if (factory === undefined) {
    throw new Error(`no fetcher registered for provider ${provider}`);
  }
  return factory();
}

/**
 * Close shared browser resources held by the registry.
 *
 * Must be called on process shutdown. Safe to call even if no Playwright
 * fetcher was ever used (browserManager.close() is idempotent).
 */
export async function closeRegistryResources(): Promise<void> {
  await browserManager.close();
}
