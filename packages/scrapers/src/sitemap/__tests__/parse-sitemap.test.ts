import { describe, it, expect } from 'vitest';
import { parseSitemapEntries, parseSitemapIndexEntries, normalizeLastmod } from '../parse-sitemap.js';

// ──────────────────────────────────────────────────────────────
// normalizeLastmod — the three lastmod formats seen across providers
// ──────────────────────────────────────────────────────────────

describe('normalizeLastmod', () => {
  it('normalizes a full ISO 8601 value with a +03:00 offset to UTC', () => {
    expect(normalizeLastmod('2026-07-08T16:00:45+03:00')).toBe('2026-07-08T13:00:45.000Z');
  });

  it('normalizes a date-only value to midnight UTC that day', () => {
    expect(normalizeLastmod('2026-06-26')).toBe('2026-06-26T00:00:00.000Z');
  });

  it('truncates RFC3339 sub-millisecond precision to milliseconds', () => {
    expect(normalizeLastmod('2026-02-12T22:05:00.280930205Z')).toBe('2026-02-12T22:05:00.280Z');
  });

  it('passes through a plain millisecond-precision UTC value', () => {
    expect(normalizeLastmod('2026-02-12T22:05:00.280Z')).toBe('2026-02-12T22:05:00.280Z');
  });

  it('returns null for missing / blank / unparseable input', () => {
    expect(normalizeLastmod(null)).toBeNull();
    expect(normalizeLastmod(undefined)).toBeNull();
    expect(normalizeLastmod('')).toBeNull();
    expect(normalizeLastmod('   ')).toBeNull();
    expect(normalizeLastmod('not-a-date')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseSitemapEntries
// ──────────────────────────────────────────────────────────────

describe('parseSitemapEntries', () => {
  it('parses a flat urlset with lastmod entries', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://bookchef.ua/donka-zemli</loc>
          <lastmod>2026-07-08T16:00:45+03:00</lastmod>
        </url>
        <url>
          <loc>https://bookchef.ua/aliaska</loc>
          <lastmod>2026-06-26</lastmod>
        </url>
      </urlset>`;

    const { entries, error } = parseSitemapEntries(xml);
    expect(error).toBeUndefined();
    expect(entries).toEqual([
      { url: 'https://bookchef.ua/donka-zemli', lastmod: '2026-07-08T13:00:45.000Z' },
      { url: 'https://bookchef.ua/aliaska', lastmod: '2026-06-26T00:00:00.000Z' },
    ]);
  });

  it('yields a null lastmod when the entry has no <lastmod>', () => {
    const xml = `<urlset><url><loc>https://bookchef.ua/no-lastmod</loc></url></urlset>`;
    const { entries } = parseSitemapEntries(xml);
    expect(entries).toEqual([{ url: 'https://bookchef.ua/no-lastmod', lastmod: null }]);
  });

  it('dedupes by url, first entry wins, preserving document order', () => {
    const xml = `<urlset>
      <url><loc>https://bookchef.ua/a</loc><lastmod>2026-01-01</lastmod></url>
      <url><loc>https://bookchef.ua/b</loc><lastmod>2026-01-02</lastmod></url>
      <url><loc>https://bookchef.ua/a</loc><lastmod>2026-01-03</lastmod></url>
    </urlset>`;
    const { entries } = parseSitemapEntries(xml);
    expect(entries).toEqual([
      { url: 'https://bookchef.ua/a', lastmod: '2026-01-01T00:00:00.000Z' },
      { url: 'https://bookchef.ua/b', lastmod: '2026-01-02T00:00:00.000Z' },
    ]);
  });

  it('returns an error for empty/blank input', () => {
    expect(parseSitemapEntries('')).toEqual({ entries: [], error: 'empty sitemap' });
    expect(parseSitemapEntries('   ')).toEqual({ entries: [], error: 'empty sitemap' });
  });

  it('returns an error when there are no <loc> entries (malformed / unrelated XML)', () => {
    const { entries, error } = parseSitemapEntries('<not-a-sitemap><foo/></not-a-sitemap>');
    expect(entries).toEqual([]);
    expect(error).toBe('no <loc> entries found in sitemap');
  });

  it('never throws on garbled/unclosed XML', () => {
    expect(() => parseSitemapEntries('<urlset><url><loc>https://x/a')).not.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────
// parseSitemapIndexEntries
// ──────────────────────────────────────────────────────────────

describe('parseSitemapIndexEntries', () => {
  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://knigoland.ua/sitemap-products-1.xml</loc></sitemap>
      <sitemap><loc>https://knigoland.ua/sitemap-categories.xml</loc></sitemap>
      <sitemap><loc>https://knigoland.ua/sitemap-products-2.xml</loc></sitemap>
    </sitemapindex>`;

  it('parses all sub-sitemap locs when no filter is given', () => {
    const { sitemaps, error } = parseSitemapIndexEntries(indexXml);
    expect(error).toBeUndefined();
    expect(sitemaps).toEqual([
      'https://knigoland.ua/sitemap-products-1.xml',
      'https://knigoland.ua/sitemap-categories.xml',
      'https://knigoland.ua/sitemap-products-2.xml',
    ]);
  });

  it('applies the filter to narrow which sub-sitemaps are kept', () => {
    const { sitemaps } = parseSitemapIndexEntries(indexXml, (loc) => loc.includes('products'));
    expect(sitemaps).toEqual([
      'https://knigoland.ua/sitemap-products-1.xml',
      'https://knigoland.ua/sitemap-products-2.xml',
    ]);
  });

  it('returns an error for empty input', () => {
    expect(parseSitemapIndexEntries('')).toEqual({ sitemaps: [], error: 'empty sitemap index' });
  });

  it('returns an error when there are no <sitemap><loc> entries', () => {
    const { sitemaps, error } = parseSitemapIndexEntries('<sitemapindex></sitemapindex>');
    expect(sitemaps).toEqual([]);
    expect(error).toBe('no <sitemap><loc> entries found in sitemap index');
  });
});
