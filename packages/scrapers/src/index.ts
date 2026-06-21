export { YakabooScraper, VivatScraper, BookYeScraper } from './providers/index.js';
export { BrowserManager, browserManager } from './http/browser-manager.js';
export { PlaywrightHtmlFetcher } from './http/playwright-html-fetcher.js';
export * from './canonical/index.js';
export { sanitizeDescription, DESCRIPTION_MAX_CHARS } from './lib/sanitize-description.js';
export { enrichDescriptions, isRateLimited } from './lib/enrich-descriptions.js';
