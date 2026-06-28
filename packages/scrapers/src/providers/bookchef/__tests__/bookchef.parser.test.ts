import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  parseBookChefListing,
  parseBookChefProduct,
  bookChefPriceToKopecks,
} from '../bookchef.parser.js';
import { buildCoverUrl, buildProductUrl, isPaperBookType } from '../constants.js';
import { normalizeIsbn } from '../../../canonical/isbn.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

// All __fixtures__/*.html are REAL captured BookChef pages (recon 2026-06-27):
//   product-instock.html    → /na-vershynu-svitu  (InStock,  isbn 978-966-279-323-9, 259.00)
//   product-preorder.html   → /donka-zemli        (PreOrder, isbn 978-617-548-573-6, 320.00)
//   product-outofstock.html → /aliaska            (OutOfStock, isbn 978-617-7914-20-3, 420.00)
//   catalog-no-product.html → /catalog            (no @type:Product JSON-LD block)
// Error branches the live site never emits (malformed JSON, missing name/url,
// absent isbn) are exercised by perturbing the real markup in-memory or with a
// minimal inline string — never by a synthetic fixture file.

// ──────────────────────────────────────────────────────────────
// bookChefPriceToKopecks — Money parsing
// ──────────────────────────────────────────────────────────────

describe('bookChefPriceToKopecks', () => {
  it('parses a numeric string like "320.00" to kopecks', () => {
    expect(bookChefPriceToKopecks('320.00')).toBe(32000);
  });

  it('parses a plain number to kopecks', () => {
    expect(bookChefPriceToKopecks(259)).toBe(25900);
  });

  it('rounds fractional hryvnias (number and string)', () => {
    expect(bookChefPriceToKopecks(199.5)).toBe(19950);
    expect(bookChefPriceToKopecks('199.50')).toBe(19950);
  });

  it('returns null for zero', () => {
    expect(bookChefPriceToKopecks(0)).toBeNull();
    expect(bookChefPriceToKopecks('0')).toBeNull();
  });

  it('returns null for negative values', () => {
    expect(bookChefPriceToKopecks(-100)).toBeNull();
    expect(bookChefPriceToKopecks('-5')).toBeNull();
  });

  it('returns null for NaN / Infinity', () => {
    expect(bookChefPriceToKopecks(NaN)).toBeNull();
    expect(bookChefPriceToKopecks(Infinity)).toBeNull();
  });

  it('returns null for null / undefined', () => {
    expect(bookChefPriceToKopecks(null)).toBeNull();
    expect(bookChefPriceToKopecks(undefined)).toBeNull();
  });

  it('returns null for non-numeric / empty / object input', () => {
    expect(bookChefPriceToKopecks('abc')).toBeNull();
    expect(bookChefPriceToKopecks('')).toBeNull();
    expect(bookChefPriceToKopecks({})).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseBookChefListing — real product pages (JSON-LD mapping)
// ──────────────────────────────────────────────────────────────

describe('parseBookChefListing — product-instock.html (real)', () => {
  const { listing, errors } = parseBookChefListing(loadFixture('product-instock.html'));

  it('produces a listing with no errors', () => {
    expect(errors).toEqual([]);
    expect(listing).not.toBeNull();
  });

  it('maps all listing fields from JSON-LD', () => {
    expect(listing).toMatchObject({
      provider: 'bookchef',
      title: 'На Вершину Світу',
      author: 'Славко Ґобарг',
      isbn: '9789662793239',
      price: { amount: 25900, currency: 'UAH' },
      url: 'https://bookchef.ua/na-vershynu-svitu',
      availability: 'in-stock',
      description: null,
    });
  });

  it('resolves an absolute cover URL', () => {
    expect(listing?.coverUrl).toMatch(/^https:\/\/bookchef\.ua\/storage\//);
  });
});

describe('parseBookChefListing — product-preorder.html (real)', () => {
  const { listing } = parseBookChefListing(loadFixture('product-preorder.html'));

  it('maps preorder product (PreOrder → in-stock)', () => {
    expect(listing).toMatchObject({
      provider: 'bookchef',
      title: 'Донька землі',
      author: 'Максим Бутченко',
      isbn: '9786175485736',
      price: { amount: 32000, currency: 'UAH' },
      url: 'https://bookchef.ua/donka-zemli',
      availability: 'in-stock',
    });
  });
});

describe('parseBookChefListing — product-outofstock.html (real)', () => {
  const { listing } = parseBookChefListing(loadFixture('product-outofstock.html'));

  it('maps out-of-stock product (OutOfStock → out-of-stock)', () => {
    expect(listing).toMatchObject({
      provider: 'bookchef',
      title: 'Аляска',
      author: 'Анна Волц',
      isbn: '9786177914203',
      price: { amount: 42000, currency: 'UAH' },
      url: 'https://bookchef.ua/aliaska',
      availability: 'out-of-stock',
    });
  });
});

// ──────────────────────────────────────────────────────────────
// parseBookChefListing — ISBN / GTIN fallback (real markup perturbed)
// ──────────────────────────────────────────────────────────────

describe('parseBookChefListing — ISBN handling', () => {
  const realInstock = loadFixture('product-instock.html');

  it('normalizes the JSON-LD isbn (hyphens stripped)', () => {
    const { listing } = parseBookChefListing(realInstock);
    expect(listing?.isbn).toBe('9789662793239');
  });

  it('falls back to gtin13 when isbn is absent', () => {
    const html = realInstock.replace('"isbn":"978-966-279-323-9",', '');
    const { listing } = parseBookChefListing(html);
    expect(listing?.isbn).toBe('9789662793239'); // from gtin13
  });

  it('yields isbn: null when isbn is invalid and gtin13 is absent', () => {
    const html = realInstock
      .replace('"isbn":"978-966-279-323-9"', '"isbn":"978-966-279-323-0"') // bad checksum
      .replace('"gtin13":"9789662793239",', '');
    const { listing } = parseBookChefListing(html);
    expect(listing).not.toBeNull();
    expect(listing?.isbn).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseBookChefListing — error branches (never thrown)
// ──────────────────────────────────────────────────────────────

describe('parseBookChefListing — author resolution', () => {
  const realInstock = loadFixture('product-instock.html');

  it('reads a plain-string author', () => {
    const html = realInstock.replace(
      '"author":[{"@type":"Person","name":"Славко Ґобарг"}]',
      '"author":"Славко Ґобарг"',
    );
    expect(parseBookChefListing(html).listing?.author).toBe('Славко Ґобарг');
  });

  it('joins multiple authors', () => {
    const html = realInstock.replace(
      '"author":[{"@type":"Person","name":"Славко Ґобарг"}]',
      '"author":[{"@type":"Person","name":"Славко Ґобарг"},{"@type":"Person","name":"Інший Автор"}]',
    );
    expect(parseBookChefListing(html).listing?.author).toBe('Славко Ґобарг, Інший Автор');
  });

  it('falls back to brand.name when author is an empty array', () => {
    const html = realInstock.replace(
      '"author":[{"@type":"Person","name":"Славко Ґобарг"}]',
      '"author":[]',
    );
    expect(parseBookChefListing(html).listing?.author).toBe('Зелений пес');
  });
});

describe('parseBookChefListing — availability fallbacks', () => {
  const realInstock = loadFixture('product-instock.html');

  it('maps a priced product with no availability field to unknown', () => {
    const html = realInstock.replace('"availability":"https://schema.org/InStock",', '');
    const { listing } = parseBookChefListing(html);
    expect(listing?.price).not.toBeNull();
    expect(listing?.availability).toBe('unknown');
  });

  it('maps an unrecognized schema.org availability to unknown', () => {
    const html = realInstock.replace(
      'https://schema.org/InStock',
      'https://schema.org/Discontinued',
    );
    const { listing } = parseBookChefListing(html);
    expect(listing?.availability).toBe('unknown');
  });
});

describe('parseBookChefListing — error handling', () => {
  it('returns listing: null + error for a page with no Product JSON-LD (real catalog)', () => {
    const { listing, errors } = parseBookChefListing(loadFixture('catalog-no-product.html'));
    expect(listing).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('records malformed JSON-LD without throwing', () => {
    const html =
      '<html><head><script type="application/ld+json">{ "@type": "Product", broken }</script></head></html>';
    const { listing, errors } = parseBookChefListing(html);
    expect(listing).toBeNull();
    expect(errors.some((e) => e.includes('malformed JSON-LD'))).toBe(true);
  });

  it('skips a product missing its name', () => {
    const html = loadFixture('product-instock.html').replace(
      '"@type":"Product","name":"На Вершину Світу",',
      '"@type":"Product",',
    );
    const { listing, errors } = parseBookChefListing(html);
    expect(listing).toBeNull();
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('skips a product missing offers.url', () => {
    const html = loadFixture('product-instock.html').replace(
      '"url":"https://bookchef.ua/na-vershynu-svitu",',
      '',
    );
    const { listing, errors } = parseBookChefListing(html);
    expect(listing).toBeNull();
    expect(errors.some((e) => e.includes('url'))).toBe(true);
  });

  it('skips a product with no offers object at all', () => {
    const html = loadFixture('product-instock.html').replace('"offers":{', '"_offers":{');
    const { listing, errors } = parseBookChefListing(html);
    expect(listing).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────
// parseBookChefProduct — single-product price/availability state
// ──────────────────────────────────────────────────────────────

describe('parseBookChefProduct', () => {
  it('reads price + availability from a real in-stock page', () => {
    expect(parseBookChefProduct(loadFixture('product-instock.html'))).toEqual({
      price: { amount: 25900, currency: 'UAH' },
      availability: 'in-stock',
    });
  });

  it('reads out-of-stock state from a real page', () => {
    expect(parseBookChefProduct(loadFixture('product-outofstock.html'))).toEqual({
      price: { amount: 42000, currency: 'UAH' },
      availability: 'out-of-stock',
    });
  });

  it('returns { price: null, availability: unknown } when no Product JSON-LD (real catalog)', () => {
    expect(parseBookChefProduct(loadFixture('catalog-no-product.html'))).toEqual({
      price: null,
      availability: 'unknown',
    });
  });

  it('returns { price: null, availability: out-of-stock } when price is absent', () => {
    const html = loadFixture('product-instock.html').replace('"price":"259.00"', '"price":"0"');
    expect(parseBookChefProduct(html)).toEqual({ price: null, availability: 'out-of-stock' });
  });

  it('returns { price: null, availability: out-of-stock } when offers object is absent', () => {
    const html = loadFixture('product-instock.html').replace('"offers":{', '"_offers":{');
    expect(parseBookChefProduct(html)).toEqual({ price: null, availability: 'out-of-stock' });
  });
});

// ──────────────────────────────────────────────────────────────
// constants — buildCoverUrl / buildProductUrl / isPaperBookType
// ──────────────────────────────────────────────────────────────

describe('buildCoverUrl', () => {
  it('passes through an absolute URL', () => {
    expect(buildCoverUrl('https://cdn.x/a.jpg')).toBe('https://cdn.x/a.jpg');
  });

  it('prefixes a site-relative path with the base URL', () => {
    expect(buildCoverUrl('/storage/a.jpg')).toBe('https://bookchef.ua/storage/a.jpg');
  });

  it('prefixes a bare relative path with base URL + slash', () => {
    expect(buildCoverUrl('storage/a.jpg')).toBe('https://bookchef.ua/storage/a.jpg');
  });

  it('upgrades a protocol-relative URL to https', () => {
    expect(buildCoverUrl('//cdn.x/a.jpg')).toBe('https://cdn.x/a.jpg');
  });

  it('takes the first usable string from an array', () => {
    expect(buildCoverUrl(['', '/storage/a.jpg'])).toBe('https://bookchef.ua/storage/a.jpg');
  });

  it('returns null for missing / blank / non-string input', () => {
    expect(buildCoverUrl(null)).toBeNull();
    expect(buildCoverUrl(undefined)).toBeNull();
    expect(buildCoverUrl('')).toBeNull();
    expect(buildCoverUrl(123)).toBeNull();
    expect(buildCoverUrl([])).toBeNull();
  });
});

describe('buildProductUrl', () => {
  it('builds an absolute URL from a slug', () => {
    expect(buildProductUrl('donka-zemli')).toBe('https://bookchef.ua/donka-zemli');
  });

  it('trims a leading slash', () => {
    expect(buildProductUrl('/donka-zemli')).toBe('https://bookchef.ua/donka-zemli');
  });
});

describe('isPaperBookType', () => {
  it('treats missing / blank type as paper', () => {
    expect(isPaperBookType(undefined)).toBe(true);
    expect(isPaperBookType('')).toBe(true);
  });

  it('flags non-paper markers', () => {
    expect(isPaperBookType('ebook')).toBe(false);
    expect(isPaperBookType('audio')).toBe(false);
  });

  it('treats a plain book type as paper', () => {
    expect(isPaperBookType('Паперова книга')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// normalizeIsbn — shared canonical helper used by the parser
// ──────────────────────────────────────────────────────────────

describe('normalizeIsbn', () => {
  it('converts a valid ISBN-10 to ISBN-13', () => {
    expect(normalizeIsbn('0-306-40615-2')).toBe('9780306406157');
  });

  it('passes through a valid ISBN-13', () => {
    expect(normalizeIsbn('9789662793239')).toBe('9789662793239');
  });

  it('returns null for invalid / unparseable input', () => {
    expect(normalizeIsbn('INVALID')).toBeNull();
    expect(normalizeIsbn('978-966-279-323-0')).toBeNull(); // bad checksum
    expect(normalizeIsbn(null)).toBeNull();
  });
});
