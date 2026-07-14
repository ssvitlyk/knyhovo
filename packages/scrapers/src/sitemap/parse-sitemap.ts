import * as cheerio from 'cheerio';
import type { SitemapEntry } from '@knyhovo/shared';

/** Result of parsing a flat `<urlset>` sitemap into entries. */
export interface ParseSitemapResult {
  /** Unique `{url, lastmod}` entries in document order (first `<loc>` wins on duplicates). */
  readonly entries: SitemapEntry[];
  readonly error?: string;
}

/** Result of parsing a sitemap index (`<sitemapindex>`) into sub-sitemap URLs. */
export interface ParseSitemapIndexResult {
  /** Unique sub-sitemap URLs in document order, after `filter` (when given). */
  readonly sitemaps: string[];
  readonly error?: string;
}

const SUB_MS_FRACTION_UTC_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d+)Z$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalize a raw `<lastmod>` value to an ISO 8601 UTC string. Handles three
 * formats seen across provider sitemaps:
 *   - full ISO 8601 with offset, e.g. `2026-07-08T16:00:45+03:00`
 *   - date-only, e.g. `2026-06-26` → midnight UTC that day
 *   - RFC3339 with sub-millisecond precision, e.g.
 *     `2026-02-12T22:05:00.280930205Z` → truncated to milliseconds
 * Returns null (never throws) for blank/unparseable input — "no signal", not
 * an error condition.
 */
export function normalizeLastmod(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (DATE_ONLY_RE.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  // Date parses fractional seconds beyond milliseconds inconsistently across
  // engines, so truncate sub-ms digits ourselves before handing off to Date.
  const fractionMatch = SUB_MS_FRACTION_UTC_RE.exec(trimmed);
  const candidate = fractionMatch
    ? `${fractionMatch[1]}.${fractionMatch[2].slice(0, 3).padEnd(3, '0')}Z`
    : trimmed;

  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Parse a flat sitemap `<urlset>` into deduplicated `{url, lastmod}` entries.
 * Pure function — no IO, never throws. Malformed XML yields no `<url>`
 * elements (cheerio degrades gracefully), which surfaces as the same "no <loc>
 * entries" error as a genuinely empty sitemap.
 */
export function parseSitemapEntries(xml: string): ParseSitemapResult {
  const trimmed = typeof xml === 'string' ? xml.trim() : '';
  if (!trimmed) {
    return { entries: [], error: 'empty sitemap' };
  }

  const $ = cheerio.load(trimmed, { xml: true });
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();

  $('url').each((_, el) => {
    const loc = $(el).find('loc').first().text().trim();
    if (!loc || seen.has(loc)) return;
    seen.add(loc);
    const lastmodRaw = $(el).find('lastmod').first().text().trim();
    entries.push({ url: loc, lastmod: normalizeLastmod(lastmodRaw || null) });
  });

  if (entries.length === 0) {
    return { entries, error: 'no <loc> entries found in sitemap' };
  }
  return { entries };
}

/**
 * Parse a sitemap index (`<sitemapindex>` of `<sitemap><loc>`) into
 * deduplicated sub-sitemap URLs, optionally narrowed by `filter`. Pure
 * function — no IO, never throws.
 */
export function parseSitemapIndexEntries(
  xml: string,
  filter?: (loc: string) => boolean,
): ParseSitemapIndexResult {
  const trimmed = typeof xml === 'string' ? xml.trim() : '';
  if (!trimmed) {
    return { sitemaps: [], error: 'empty sitemap index' };
  }

  const $ = cheerio.load(trimmed, { xml: true });
  const sitemaps: string[] = [];
  const seen = new Set<string>();

  $('sitemap > loc').each((_, el) => {
    const loc = $(el).text().trim();
    if (!loc || seen.has(loc)) return;
    if (filter && !filter(loc)) return;
    seen.add(loc);
    sitemaps.push(loc);
  });

  if (sitemaps.length === 0) {
    return { sitemaps, error: 'no <sitemap><loc> entries found in sitemap index' };
  }
  return { sitemaps };
}
