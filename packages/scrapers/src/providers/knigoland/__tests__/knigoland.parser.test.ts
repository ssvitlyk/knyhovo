import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  parseKnigolandListing,
  parseKnigolandProduct,
  parseKnigolandSitemap,
  parseKnigolandSitemapIndex,
  knigolandPriceToKopecks,
} from '../knigoland.parser.js';
import { buildCoverUrl } from '../constants.js';
import { normalizeIsbn } from '../../../canonical/isbn.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

// All __fixtures__ are REAL captured Knigoland artifacts (recon 2026-07-05, after the
// site migration that dropped the `@type:Book` JSON-LD block from every product page):
//   sitemap-index.xml       → full /sitemaps/sitemap.xml (index of sub-sitemaps)
//   sitemap-products.xml    → first 12 <url> entries of sections/catalog-products-1.xml
//   product-instock.html    → /his-last-bow-item  (InStock,    isbn 9789660396999, 200)
//   product-outofstock.html → /galapagos-item     (OutOfStock, isbn 9786176141594, 250 — keeps price)
//   product-instock-2.html  → /gra-v-biser-item   (InStock,    isbn 9789660392595, 780)
//   product-nonbook.html    → /kartonnyy-...-boxer (barcode 4820191135000, not Bookland → silent skip)
// Error/edge branches the live site never emits (malformed JSON, missing name/url,
// multi-author, absent isbn → sku fallback) are exercised by perturbing real markup
// in-memory or with a minimal inline string — never by a synthetic fixture file.

/** Wrap a Product JSON-LD block plus an optional spec-table ISBN / meta-description author into a minimal product-page HTML string. */
function productHtml(opts: { product?: unknown; isbn?: string; author?: string }): string {
  const scripts: string[] = [];
  if (opts.product !== undefined) {
    scripts.push(`<script type="application/ld+json">${JSON.stringify(opts.product)}</script>`);
  }
  const meta =
    opts.author !== undefined
      ? `<meta name="description" content="Купити книгу X автора ${opts.author} арт: 1 в 👉 КнигоЛенд"/>`
      : '';
  const specRows: string[] = [];
  if (opts.isbn !== undefined) {
    specRows.push(
      `<div class="flex items-start"><div class="flex items-center w-full max-w-[60%]">` +
        `<span class="whitespace-nowrap">ISBN</span></div>` +
        `<span class="w-[220px]"><div><span>${opts.isbn}</span></div></span></div>`,
    );
  }
  return `<html><head>${scripts.join('')}${meta}</head><body>${specRows.join('')}</body></html>`;
}

// ──────────────────────────────────────────────────────────────
// knigolandPriceToKopecks — Money parsing
// ──────────────────────────────────────────────────────────────

describe('knigolandPriceToKopecks', () => {
  it('parses a plain number to kopecks', () => {
    expect(knigolandPriceToKopecks(200)).toBe(20000);
  });

  it('parses a whole-number string like "780" to kopecks', () => {
    expect(knigolandPriceToKopecks('780')).toBe(78000);
  });

  it('rounds fractional hryvnias (number and string)', () => {
    expect(knigolandPriceToKopecks(199.5)).toBe(19950);
    expect(knigolandPriceToKopecks('199.50')).toBe(19950);
  });

  it('returns null for zero', () => {
    expect(knigolandPriceToKopecks(0)).toBeNull();
    expect(knigolandPriceToKopecks('0')).toBeNull();
  });

  it('returns null for negative values', () => {
    expect(knigolandPriceToKopecks(-100)).toBeNull();
    expect(knigolandPriceToKopecks('-5')).toBeNull();
  });

  it('returns null for NaN / Infinity', () => {
    expect(knigolandPriceToKopecks(NaN)).toBeNull();
    expect(knigolandPriceToKopecks(Infinity)).toBeNull();
  });

  it('returns null for null / undefined', () => {
    expect(knigolandPriceToKopecks(null)).toBeNull();
    expect(knigolandPriceToKopecks(undefined)).toBeNull();
  });

  it('returns null for non-numeric / empty / object input', () => {
    expect(knigolandPriceToKopecks('abc')).toBeNull();
    expect(knigolandPriceToKopecks('')).toBeNull();
    expect(knigolandPriceToKopecks({})).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandSitemapIndex — product sub-sitemap discovery
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandSitemapIndex', () => {
  it('keeps only the catalog-products sub-sitemaps from a real index', () => {
    const { sitemapUrls, errors } = parseKnigolandSitemapIndex(loadFixture('sitemap-index.xml'));
    expect(errors).toEqual([]);
    expect(sitemapUrls).toEqual([
      'https://knigoland.com.ua/sitemaps/sections/catalog-products-1.xml',
      'https://knigoland.com.ua/sitemaps/sections/catalog-products-2.xml',
      'https://knigoland.com.ua/sitemaps/sections/catalog-products-3.xml',
      'https://knigoland.com.ua/sitemaps/sections/catalog-products-4.xml',
      'https://knigoland.com.ua/sitemaps/sections/catalog-products-5.xml',
    ]);
  });

  it('does not match the image sub-sitemaps (catalog-products-images-N.xml)', () => {
    const { sitemapUrls } = parseKnigolandSitemapIndex(loadFixture('sitemap-index.xml'));
    expect(sitemapUrls.some((u) => u.includes('images'))).toBe(false);
  });

  it('deduplicates repeated matching <loc> entries in document order', () => {
    const xml =
      '<sitemapindex>' +
      '<sitemap><loc>https://knigoland.com.ua/sitemaps/sections/catalog-products-1.xml</loc></sitemap>' +
      '<sitemap><loc>https://knigoland.com.ua/sitemaps/sections/catalog-products-2.xml</loc></sitemap>' +
      '<sitemap><loc>https://knigoland.com.ua/sitemaps/sections/catalog-products-1.xml</loc></sitemap>' +
      '</sitemapindex>';
    expect(parseKnigolandSitemapIndex(xml).sitemapUrls).toEqual([
      'https://knigoland.com.ua/sitemaps/sections/catalog-products-1.xml',
      'https://knigoland.com.ua/sitemaps/sections/catalog-products-2.xml',
    ]);
  });

  it('returns [] + error for empty / blank input', () => {
    expect(parseKnigolandSitemapIndex('')).toEqual({
      sitemapUrls: [],
      errors: ['empty sitemap index'],
    });
    expect(parseKnigolandSitemapIndex('   ').sitemapUrls).toEqual([]);
  });

  it('returns [] + error when no catalog-products sub-sitemaps match', () => {
    const xml =
      '<sitemapindex><sitemap>' +
      '<loc>https://knigoland.com.ua/sitemaps/images/authors-images-1.xml</loc>' +
      '</sitemap></sitemapindex>';
    const { sitemapUrls, errors } = parseKnigolandSitemapIndex(xml);
    expect(sitemapUrls).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandSitemap — product-URL discovery
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandSitemap', () => {
  it('extracts product URLs from a real sitemap fragment', () => {
    const { urls, errors } = parseKnigolandSitemap(loadFixture('sitemap-products.xml'));
    expect(errors).toEqual([]);
    expect(urls).toHaveLength(12);
    expect(urls[0]).toBe('https://knigoland.com.ua/his-last-bow-item');
    expect(urls.every((u) => u.endsWith('-item'))).toBe(true);
  });

  it('deduplicates repeated <loc> entries in document order', () => {
    const xml =
      '<urlset><url><loc>https://knigoland.com.ua/a-item</loc></url>' +
      '<url><loc>https://knigoland.com.ua/b-item</loc></url>' +
      '<url><loc>https://knigoland.com.ua/a-item</loc></url></urlset>';
    expect(parseKnigolandSitemap(xml).urls).toEqual([
      'https://knigoland.com.ua/a-item',
      'https://knigoland.com.ua/b-item',
    ]);
  });

  it('returns urls: [] + error for empty / blank input', () => {
    expect(parseKnigolandSitemap('')).toEqual({ urls: [], errors: ['empty sitemap'] });
    expect(parseKnigolandSitemap('   ').urls).toEqual([]);
  });

  it('returns urls: [] + error for a sitemap with no <loc> entries', () => {
    const { urls, errors } = parseKnigolandSitemap('<urlset></urlset>');
    expect(urls).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandListing — real product pages (JSON-LD Product + spec-table merge)
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandListing — product-instock.html (real)', () => {
  const { listing, errors } = parseKnigolandListing(loadFixture('product-instock.html'));

  it('produces a listing with no errors', () => {
    expect(errors).toEqual([]);
    expect(listing).not.toBeNull();
  });

  it('merges the Product JSON-LD block with the spec-table isbn/authors', () => {
    expect(listing).toMatchObject({
      provider: 'knigoland',
      title: 'His Last Bow',
      author: 'Артур Конан Дойл',
      isbn: '9789660396999',
      price: { amount: 20000, currency: 'UAH' },
      url: 'https://knigoland.com.ua/his-last-bow-item',
      availability: 'in-stock',
    });
  });

  it('extracts and sanitizes the description from Product.description', () => {
    // Always-on (no enrichDescriptions flag needed): this sitemap-driven provider
    // already fetched the product page for every listing.
    expect(listing?.description).toBe(
      '«Його останній уклін» — одне з оповідань шотландського письменника Артура Конан ' +
        'Дойла (1859–1930) про відомого детектива Шерлока Голмса. Шерлоку Голмсу та його ' +
        'незмінному помічникові належить розкрити низку нових злочинів. Однак військові ' +
        'таємниці Великобританії не мусять потрапити до рук ворога. Рівень складності – ' +
        'Intermediate.',
    );
  });

  it('resolves an absolute cover URL from the Product.image array', () => {
    expect(listing?.coverUrl).toBe(
      'https://admin.knigoland.com.ua/assets/1f8db213-00cb-4b8c-aee0-ec7c26d87616.png',
    );
  });

  it('extracts rawCategories from the breadcrumb, never the WebSite.genre tagline (genres-taxonomy G2)', () => {
    expect(listing?.rawCategories).toEqual([
      'Книги',
      'Художня література',
      'Білінгва. Книги іноземними мовами',
    ]);
    expect(listing?.rawCategories).not.toContain(
      'Книголенд - Інтернет-магазин книг, подарунків і дитячих товарів.',
    );
  });
});

describe('parseKnigolandListing — product-instock-2.html (real)', () => {
  const { listing } = parseKnigolandListing(loadFixture('product-instock-2.html'));

  it('maps a second in-stock product', () => {
    expect(listing).toMatchObject({
      provider: 'knigoland',
      title: 'Гра в бісер',
      author: 'Герман Гессе',
      isbn: '9789660392595',
      price: { amount: 78000, currency: 'UAH' },
      url: 'https://knigoland.com.ua/gra-v-biser-item',
      availability: 'in-stock',
    });
  });

  it('extracts rawCategories from the breadcrumb, never the WebSite.genre tagline (genres-taxonomy G2)', () => {
    expect(listing?.rawCategories).toEqual(['Книги', 'Художня література', 'Класична проза']);
    expect(listing?.rawCategories).not.toContain(
      'Книголенд - Інтернет-магазин книг, подарунків і дитячих товарів.',
    );
  });
});

describe('parseKnigolandListing — product-outofstock.html (real)', () => {
  const { listing } = parseKnigolandListing(loadFixture('product-outofstock.html'));

  it('maps an out-of-stock product that still carries a price', () => {
    expect(listing).toMatchObject({
      provider: 'knigoland',
      title: 'ҐАЛАПАҐОС',
      author: 'Курт Воннегут',
      isbn: '9786176141594',
      price: { amount: 25000, currency: 'UAH' },
      url: 'https://knigoland.com.ua/galapagos-item',
      availability: 'out-of-stock',
    });
  });

  it('extracts rawCategories from the breadcrumb, never the WebSite.genre tagline (genres-taxonomy G2)', () => {
    expect(listing?.rawCategories).toEqual([
      'Книги',
      'Художня література',
      'Фантастика. Фентезі. Містика',
    ]);
    expect(listing?.rawCategories).not.toContain(
      'Книголенд - Інтернет-магазин книг, подарунків і дитячих товарів.',
    );
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandListing — paper-book filter (Bookland-prefixed spec-table ISBN)
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandListing — paper-book filter', () => {
  it('silently skips a real non-book (spec-table barcode, not Bookland-prefixed)', () => {
    // Non-book fixtures are filtered out before the rawCategories extraction
    // code path is ever reached — listing is null, so there is no
    // rawCategories to assert on here (genres-taxonomy G2).
    const { listing, errors } = parseKnigolandListing(loadFixture('product-nonbook.html'));
    expect(listing).toBeNull();
    expect(errors).toEqual([]);
  });

  it('silently skips a synthetic product with no spec-table ISBN at all', () => {
    const html = productHtml({
      product: {
        '@type': 'Product',
        name: 'Пазл',
        offers: { '@type': 'Offer', price: 999, url: 'https://knigoland.com.ua/puzzle-item' },
      },
    });
    expect(parseKnigolandListing(html)).toEqual({ listing: null, errors: [] });
  });

  it('silently skips a synthetic product with a non-Bookland EAN-13 barcode', () => {
    const html = productHtml({
      product: {
        '@type': 'Product',
        name: 'Пазл',
        offers: { '@type': 'Offer', price: 999, url: 'https://knigoland.com.ua/puzzle-item' },
      },
      isbn: '4820191135000',
    });
    expect(parseKnigolandListing(html)).toEqual({ listing: null, errors: [] });
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandListing — ISBN cascade (spec-table isbn → sku → mpn)
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandListing — ISBN handling', () => {
  const realInstock = loadFixture('product-instock.html');

  it('normalizes the spec-table isbn', () => {
    expect(parseKnigolandListing(realInstock).listing?.isbn).toBe('9789660396999');
  });

  it('rejects a Bookland-prefixed spec-table isbn with a bad checksum as a non-book', () => {
    // A 978/979-prefixed value with a broken checksum still passes the Bookland-prefix
    // gate, but normalizeIsbn then rejects it and the sku/mpn fallback ("469152", a
    // 6-digit catalogue code) also fails, so isbn resolves to null (listing still kept).
    const html = realInstock.split('9789660396999').join('9789660396998');
    const { listing } = parseKnigolandListing(html);
    expect(listing).not.toBeNull();
    expect(listing?.isbn).toBeNull();
  });

  it('falls back through sku to mpn when the spec-table isbn is invalid', () => {
    const html = productHtml({
      product: {
        '@type': 'Product',
        name: 'X',
        mpn: '9789660396999',
        offers: { '@type': 'Offer', price: 100, url: 'https://knigoland.com.ua/x-item' },
      },
      isbn: '9789660396998', // Bookland-prefixed but bad checksum — passes the gate, fails normalizeIsbn
    });
    expect(parseKnigolandListing(html).listing?.isbn).toBe('9789660396999');
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandListing — author resolution
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandListing — author resolution', () => {
  const base = {
    product: {
      '@type': 'Product',
      name: 'X',
      offers: { '@type': 'Offer', price: 100, url: 'https://knigoland.com.ua/x-item' },
    },
    isbn: '9789660396999',
  };

  it('reads the author from the meta description (as the live site emits)', () => {
    const html = productHtml({ ...base, author: 'Соло Автор' });
    expect(parseKnigolandListing(html).listing?.author).toBe('Соло Автор');
  });

  it('collapses internal whitespace in the meta-description author', () => {
    const html = productHtml({ ...base, author: 'Коллинз  У.У.' });
    expect(parseKnigolandListing(html).listing?.author).toBe('Коллинз У.У.');
  });

  it('yields author: null when the meta description has no "автора" segment', () => {
    const html = productHtml(base);
    expect(parseKnigolandListing(html).listing?.author).toBeNull();
  });

  it('yields author: null for a non-book meta description ("Придбати «…»")', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(base.product)}</script>
      <meta name="description" content="Придбати «Пазл» арт: 1 в Україні"/></head>
      <body><div class="flex items-start"><div class="flex items-center w-full max-w-[60%]">
      <span class="whitespace-nowrap">ISBN</span></div>
      <span class="w-[220px]"><div><span>9789660396999</span></div></span></div></body></html>`;
    expect(parseKnigolandListing(html).listing?.author).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandListing — price / availability fallbacks
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandListing — price & availability', () => {
  const realInstock = loadFixture('product-instock.html');

  it('maps a zero price to price: null + out-of-stock (invariant)', () => {
    const html = realInstock.split('"price":200').join('"price":0');
    const { listing } = parseKnigolandListing(html);
    expect(listing?.price).toBeNull();
    expect(listing?.availability).toBe('out-of-stock');
  });

  it('maps a priced product with no availability field to unknown', () => {
    const html = realInstock.split('"availability":"https://schema.org/InStock",').join('');
    const { listing } = parseKnigolandListing(html);
    expect(listing?.price).not.toBeNull();
    expect(listing?.availability).toBe('unknown');
  });

  it('maps an unrecognized schema.org availability to unknown', () => {
    const html = realInstock
      .split('https://schema.org/InStock')
      .join('https://schema.org/LimitedAvailability');
    expect(parseKnigolandListing(html).listing?.availability).toBe('unknown');
  });

  it('maps OutOfStock → out-of-stock and PreOrder → in-stock', () => {
    const oos = realInstock
      .split('https://schema.org/InStock')
      .join('https://schema.org/OutOfStock');
    expect(parseKnigolandListing(oos).listing?.availability).toBe('out-of-stock');
    const pre = realInstock.split('https://schema.org/InStock').join('https://schema.org/PreOrder');
    expect(parseKnigolandListing(pre).listing?.availability).toBe('in-stock');
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandListing — description handling
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandListing — description handling', () => {
  it('yields description: null when Product.description is absent', () => {
    const html = productHtml({
      product: {
        '@type': 'Product',
        name: 'X',
        offers: { '@type': 'Offer', price: 100, url: 'https://knigoland.com.ua/x-item' },
      },
      isbn: '9789660396999',
    });
    expect(parseKnigolandListing(html).listing?.description).toBeNull();
  });

  it('yields description: null when Product.description is blank', () => {
    const html = productHtml({
      product: {
        '@type': 'Product',
        name: 'X',
        description: '   ',
        offers: { '@type': 'Offer', price: 100, url: 'https://knigoland.com.ua/x-item' },
      },
      isbn: '9789660396999',
    });
    expect(parseKnigolandListing(html).listing?.description).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandListing — JSON-LD container shapes
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandListing — container shapes', () => {
  const product = {
    '@type': ['Product'], // array @type
    name: 'Контейнер',
    sku: '9789660396999',
    offers: {
      '@type': 'Offer',
      price: 250,
      availability: 'https://schema.org/InStock',
      url: 'https://knigoland.com.ua/k-item',
    },
  };

  it('finds the Product block when it is array-typed', () => {
    const html = productHtml({ product, isbn: '9789660396999', author: 'Автор' });
    const { listing } = parseKnigolandListing(html);
    expect(listing).toMatchObject({
      title: 'Контейнер',
      author: 'Автор',
      isbn: '9789660396999',
      price: { amount: 25000, currency: 'UAH' },
      availability: 'in-stock',
    });
  });

  it('finds the Product block nested inside an @graph container', () => {
    const html =
      `<html><head><script type="application/ld+json">${JSON.stringify({ '@graph': [product] })}</script>` +
      `<meta name="description" content="Купити книгу X автора Автор арт: 1 в 👉 КнигоЛенд"/></head>` +
      `<body><div class="flex items-start"><div class="flex items-center w-full max-w-[60%]">` +
      `<span class="whitespace-nowrap">ISBN</span></div>` +
      `<span class="w-[220px]"><div><span>9789660396999</span></div></span></div></body></html>`;
    const { listing } = parseKnigolandListing(html);
    expect(listing).toMatchObject({ title: 'Контейнер', author: 'Автор', availability: 'in-stock' });
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandListing — error branches (never thrown)
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandListing — error handling', () => {
  it('returns listing: null + error when no JSON-LD is present', () => {
    const { listing, errors } = parseKnigolandListing('<html><head></head><body></body></html>');
    expect(listing).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns listing: null + error when no Product block is present', () => {
    const html = productHtml({ product: { '@type': 'Organization', name: 'Книголенд' } });
    const { listing, errors } = parseKnigolandListing(html);
    expect(listing).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('records malformed JSON-LD without throwing', () => {
    const html =
      '<html><head><script type="application/ld+json">{ "@type": "Product", broken }</script></head></html>';
    const { listing, errors } = parseKnigolandListing(html);
    expect(listing).toBeNull();
    expect(errors.some((e) => e.includes('malformed JSON-LD'))).toBe(true);
  });

  it('skips a book missing its name (Product name blanked)', () => {
    const html = loadFixture('product-instock.html').split('"name":"His Last Bow"').join('"name":""');
    const { listing, errors } = parseKnigolandListing(html);
    expect(listing).toBeNull();
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('skips a book missing its url (offers.url blanked)', () => {
    const html = loadFixture('product-instock.html')
      .split('"url":"https://knigoland.com.ua/his-last-bow-item"')
      .join('"url":""');
    const { listing, errors } = parseKnigolandListing(html);
    expect(listing).toBeNull();
    expect(errors.some((e) => e.includes('url'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// parseKnigolandProduct — single-product price/availability state
// ──────────────────────────────────────────────────────────────

describe('parseKnigolandProduct', () => {
  it('reads price + availability from a real in-stock page', () => {
    expect(parseKnigolandProduct(loadFixture('product-instock.html'))).toEqual({
      price: { amount: 20000, currency: 'UAH' },
      availability: 'in-stock',
    });
  });

  it('reads out-of-stock state from a real page (price retained)', () => {
    expect(parseKnigolandProduct(loadFixture('product-outofstock.html'))).toEqual({
      price: { amount: 25000, currency: 'UAH' },
      availability: 'out-of-stock',
    });
  });

  it('returns { price: null, availability: unknown } when no Product JSON-LD', () => {
    expect(parseKnigolandProduct('<html><head></head><body></body></html>')).toEqual({
      price: null,
      availability: 'unknown',
    });
  });

  it('returns { price: null, availability: out-of-stock } when price is absent', () => {
    const html = loadFixture('product-instock.html').split('"price":200').join('"price":0');
    expect(parseKnigolandProduct(html)).toEqual({ price: null, availability: 'out-of-stock' });
  });
});

// ──────────────────────────────────────────────────────────────
// constants — buildCoverUrl
// ──────────────────────────────────────────────────────────────

describe('buildCoverUrl', () => {
  it('passes through an absolute URL (covers live on admin.knigoland.com.ua)', () => {
    expect(buildCoverUrl('https://admin.knigoland.com.ua/assets/a.png')).toBe(
      'https://admin.knigoland.com.ua/assets/a.png',
    );
  });

  it('prefixes a site-relative path with the base URL', () => {
    expect(buildCoverUrl('/files/a.jpg')).toBe('https://knigoland.com.ua/files/a.jpg');
  });

  it('prefixes a bare relative path with base URL + slash', () => {
    expect(buildCoverUrl('files/a.jpg')).toBe('https://knigoland.com.ua/files/a.jpg');
  });

  it('upgrades a protocol-relative URL to https', () => {
    expect(buildCoverUrl('//cdn.x/a.jpg')).toBe('https://cdn.x/a.jpg');
  });

  it('takes the first usable string from an array', () => {
    expect(buildCoverUrl(['', 'https://admin.knigoland.com.ua/assets/b.jpg'])).toBe(
      'https://admin.knigoland.com.ua/assets/b.jpg',
    );
  });

  it('returns null for missing / blank / non-string input', () => {
    expect(buildCoverUrl(null)).toBeNull();
    expect(buildCoverUrl(undefined)).toBeNull();
    expect(buildCoverUrl('')).toBeNull();
    expect(buildCoverUrl(123)).toBeNull();
    expect(buildCoverUrl([])).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// normalizeIsbn — shared canonical helper used by the parser
// ──────────────────────────────────────────────────────────────

describe('normalizeIsbn', () => {
  it('passes through the valid ISBN-13s used by the fixtures', () => {
    expect(normalizeIsbn('9789660396999')).toBe('9789660396999');
    expect(normalizeIsbn('9786176141594')).toBe('9786176141594');
  });

  it('returns null for invalid / unparseable input', () => {
    expect(normalizeIsbn('469152')).toBeNull(); // a Knigoland sku, not an ISBN
    expect(normalizeIsbn('9789660396998')).toBeNull(); // bad checksum
    expect(normalizeIsbn(null)).toBeNull();
  });
});
