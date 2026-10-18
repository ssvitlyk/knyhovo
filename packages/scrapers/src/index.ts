export {
  YakabooScraper,
  VivatScraper,
  BookYeScraper,
  BookChefScraper,
  LaboratoryScraper,
  KnigolandScraper,
  BookClubScraper,
  MegaknigaScraper,
} from './providers/index.js';
export { browserManager } from './http/browser-manager.js';
export { PlaywrightHtmlFetcher } from './http/playwright-html-fetcher.js';
export { FetchHtmlFetcher } from './http/html-fetcher.js';
export type { HtmlFetcher } from './http/html-fetcher.js';
export {
  matchOrCreate,
  normalizeTitle,
  normalizeAuthor,
  normalizeIsbn,
  titleSimilarity,
  authorSimilarity,
} from './canonical/index.js';
export type { MatchResult, ConflictReason } from './canonical/index.js';
export {
  enrichProductDetails,
  isRateLimited,
} from './lib/enrich-product-details.js';
export { extractMegaknigaProductDetails } from './providers/megakniga/megakniga.parser.js';
export { fetchWithRetry } from './http/retry.js';
export type {
  ExtractedProductDetails,
  ProductDetailsExtract,
} from './lib/enrich-product-details.js';
export { SINGLE_PRODUCT_PARSERS } from './providers/single-product.js';
export type { SingleProductParser, ParsedProductState } from './providers/types.js';
export { planIncrementalFetch } from './sitemap/index.js';
