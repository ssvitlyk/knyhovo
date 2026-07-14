import type { ProviderName } from '@knyhovo/shared';

/**
 * Providers with a sitemap-diff incremental scraping mode
 * (bookchef-incremental-scraping PRD). Kept in its own file, importable from
 * both `full-catalog.refresh.ts` and `refresh-health.ts` without a circular
 * import between them.
 */
export const INCREMENTAL_SITEMAP_PROVIDERS: ReadonlySet<ProviderName> = new Set(['bookchef']);
