import type { RawProviderListing } from '@knyhovo/shared';
import type { CatalogPageResult } from '../providers/types.js';
import { errMsg } from './errors.js';
import { sleep } from './sleep.js';

export interface PaginateCatalogOptions {
  readonly maxPages: number;
  readonly delayMs: number;
  readonly buildUrl: (page: number) => string;
  /** Fetch one catalog page (timeout / retry already bound by the caller). */
  readonly fetch: (url: string) => Promise<string>;
  readonly parse: (html: string) => CatalogPageResult;
  /** Receives fetch + parse errors in encounter order. */
  readonly errors: string[];
  /** Called right before each page fetch (per-page progress logging). */
  readonly onPageStart?: (page: number, url: string) => void;
  /** Report a fetch failure; defaults to `Page N: network error — …`. The loop stops either way. */
  readonly onFetchError?: (err: unknown, page: number, errors: string[]) => void;
  /** Also stop when a page contributes no URL not seen on earlier pages. */
  readonly stopWhenNoNewListings?: boolean;
}

export interface PaginateCatalogResult {
  readonly listings: RawProviderListing[];
  /** HTML of the first successfully fetched page, for blocked-page classification. */
  readonly firstPageHtml: string | null;
  readonly pagesFetched: number;
}

/**
 * Walk a paginated catalog page by page until the parser reports no next page,
 * `maxPages` is reached or a fetch fails, de-duplicating listings by URL.
 */
export async function paginateCatalog(opts: PaginateCatalogOptions): Promise<PaginateCatalogResult> {
  const { maxPages, delayMs, errors } = opts;
  const listings: RawProviderListing[] = [];
  const seenUrls = new Set<string>();
  let firstPageHtml: string | null = null;
  let pagesFetched = 0;

  for (let page = 1; page <= maxPages; page++) {
    const url = opts.buildUrl(page);
    opts.onPageStart?.(page, url);

    let html: string;
    try {
      html = await opts.fetch(url);
      if (firstPageHtml === null) firstPageHtml = html;
    } catch (err) {
      if (opts.onFetchError) opts.onFetchError(err, page, errors);
      else errors.push(`Page ${page}: network error — ${errMsg(err)}`);
      break;
    }
    pagesFetched = page;

    const { listings: pageListings, errors: parseErrors, hasNextPage } = opts.parse(html);
    errors.push(...parseErrors);

    let newCount = 0;
    for (const listing of pageListings) {
      if (!seenUrls.has(listing.url)) {
        seenUrls.add(listing.url);
        listings.push(listing);
        newCount++;
      }
    }

    if (!hasNextPage) break;
    if (opts.stopWhenNoNewListings && newCount === 0) break;

    if (page < maxPages && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return { listings, firstPageHtml, pagesFetched };
}
