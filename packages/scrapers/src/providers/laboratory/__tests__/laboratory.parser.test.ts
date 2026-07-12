import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  parseLaboratoryListing,
  parseLaboratoryProduct,
  parseLaboratorySitemap,
  laboratoryPriceToKopecks,
} from '../laboratory.parser.js';
import { buildCoverUrl, buildProductUrl, isPaperBookType } from '../constants.js';
import { normalizeIsbn } from '../../../canonical/isbn.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

// All __fixtures__ are REAL captured Laboratory artifacts (recon 2026-06-28):
//   sitemap-products.xml    → first 12 <url> entries of /sitemap.xml/type-products
//   product-instock.html    → /products/pro-vijnu      (InStock,    isbn 9786178621117, 990, Hardcover)
//   product-outofstock.html → /products/abrykosy-donbasu(OutOfStock, EMPTY Book.isbn → sku 9789664481080, 350)
//   product-paperback.html  → /products/krasyvi-...     (InStock,    isbn 9786178621612, 409, Paperback)
// Error/edge branches the live site never emits (malformed JSON, missing name/url,
// string-vs-array author) are exercised by perturbing real markup in-memory or with
// a minimal inline string — never by a synthetic fixture file.

/** Wrap Product/Book JSON-LD objects into a minimal product-page HTML string. */
function productHtml(opts: { product?: unknown; book?: unknown }): string {
  const scripts: string[] = [];
  if (opts.product !== undefined) {
    scripts.push(
      `<script type="application/ld+json">${JSON.stringify(opts.product)}</script>`,
    );
  }
  if (opts.book !== undefined) {
    scripts.push(`<script type="application/ld+json">${JSON.stringify(opts.book)}</script>`);
  }
  return `<html><head>${scripts.join('')}</head><body></body></html>`;
}

// ──────────────────────────────────────────────────────────────
// laboratoryPriceToKopecks — Money parsing
// ──────────────────────────────────────────────────────────────

describe('laboratoryPriceToKopecks', () => {
  it('parses a whole-number string like "990" to kopecks', () => {
    expect(laboratoryPriceToKopecks('990')).toBe(99000);
  });

  it('parses a plain number to kopecks', () => {
    expect(laboratoryPriceToKopecks(409)).toBe(40900);
  });

  it('rounds fractional hryvnias (number and string)', () => {
    expect(laboratoryPriceToKopecks(199.5)).toBe(19950);
    expect(laboratoryPriceToKopecks('199.50')).toBe(19950);
  });

  it('returns null for zero', () => {
    expect(laboratoryPriceToKopecks(0)).toBeNull();
    expect(laboratoryPriceToKopecks('0')).toBeNull();
  });

  it('returns null for negative values', () => {
    expect(laboratoryPriceToKopecks(-100)).toBeNull();
    expect(laboratoryPriceToKopecks('-5')).toBeNull();
  });

  it('returns null for NaN / Infinity', () => {
    expect(laboratoryPriceToKopecks(NaN)).toBeNull();
    expect(laboratoryPriceToKopecks(Infinity)).toBeNull();
  });

  it('returns null for null / undefined', () => {
    expect(laboratoryPriceToKopecks(null)).toBeNull();
    expect(laboratoryPriceToKopecks(undefined)).toBeNull();
  });

  it('returns null for non-numeric / empty / object input', () => {
    expect(laboratoryPriceToKopecks('abc')).toBeNull();
    expect(laboratoryPriceToKopecks('')).toBeNull();
    expect(laboratoryPriceToKopecks({})).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratorySitemap — product-URL discovery
// ──────────────────────────────────────────────────────────────

describe('parseLaboratorySitemap', () => {
  it('extracts product URLs from a real sitemap fragment', () => {
    const { urls, errors } = parseLaboratorySitemap(loadFixture('sitemap-products.xml'));
    expect(errors).toEqual([]);
    expect(urls).toHaveLength(12);
    expect(urls[0]).toBe('https://laboratory.ua/products/krasyvi-divchata-tezh-pomyrayut');
    expect(urls.every((u) => u.startsWith('https://laboratory.ua/products/'))).toBe(true);
  });

  it('deduplicates repeated <loc> entries in document order', () => {
    const xml =
      '<urlset><url><loc>https://laboratory.ua/products/a</loc></url>' +
      '<url><loc>https://laboratory.ua/products/b</loc></url>' +
      '<url><loc>https://laboratory.ua/products/a</loc></url></urlset>';
    expect(parseLaboratorySitemap(xml).urls).toEqual([
      'https://laboratory.ua/products/a',
      'https://laboratory.ua/products/b',
    ]);
  });

  it('returns urls: [] + error for empty / blank input', () => {
    expect(parseLaboratorySitemap('')).toEqual({ urls: [], errors: ['empty sitemap'] });
    expect(parseLaboratorySitemap('   ').urls).toEqual([]);
  });

  it('returns urls: [] + error for a sitemap with no <loc> entries', () => {
    const { urls, errors } = parseLaboratorySitemap('<urlset></urlset>');
    expect(urls).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratoryListing — real product pages (two-block merge)
// ──────────────────────────────────────────────────────────────

describe('parseLaboratoryListing — product-instock.html (real)', () => {
  const { listing, errors } = parseLaboratoryListing(loadFixture('product-instock.html'));

  it('produces a listing with no errors', () => {
    expect(errors).toEqual([]);
    expect(listing).not.toBeNull();
  });

  it('merges Product + Book blocks into one listing', () => {
    expect(listing).toMatchObject({
      provider: 'laboratory',
      title: 'Про війну',
      author: 'Карл фон Клаузевіц',
      isbn: '9786178621117',
      price: { amount: 99000, currency: 'UAH' },
      url: 'https://laboratory.ua/products/pro-vijnu',
      availability: 'in-stock',
    });
  });

  it('extracts, decodes and sanitizes the double entity-encoded description', () => {
    // Live-verified 2026-07-09: Laboratory's Product.description is double
    // entity-encoded (the fixture's raw JSON string literally contains
    // "&amp;laquo;"/"&amp;raquo;"), so a correct decode turns it into real « » quotes —
    // not the literal "&laquo;"/"&raquo;" text a single decode would leave behind.
    expect(listing?.description).toContain(
      'книжка «Про війну» стала настільною книгою для поколінь військових',
    );
    expect(listing?.description).not.toContain('&laquo;');
    expect(listing?.description).not.toContain('&amp;');
  });

  it('resolves an absolute cover URL', () => {
    expect(listing?.coverUrl).toBe(
      'https://laboratory.ua/files/products/pro_vijnu_cover_1000.330x300.jpg.webp',
    );
  });

  it('resolves rawCategories from Book.genre (genres-taxonomy G2)', () => {
    expect(listing?.rawCategories).toEqual(['Військова справа']);
  });
});

describe('parseLaboratoryListing — product-paperback.html (real)', () => {
  const { listing } = parseLaboratoryListing(loadFixture('product-paperback.html'));

  it('maps a paperback in-stock product', () => {
    expect(listing).toMatchObject({
      provider: 'laboratory',
      title: 'Красиві дівчата теж помирають',
      author: 'Юлія Клебан',
      isbn: '9786178621612',
      price: { amount: 40900, currency: 'UAH' },
      url: 'https://laboratory.ua/products/krasyvi-divchata-tezh-pomyrayut',
      availability: 'in-stock',
    });
  });

  it('resolves rawCategories from Book.genre (genres-taxonomy G2)', () => {
    expect(listing?.rawCategories).toEqual(['детектив']);
  });
});

describe('parseLaboratoryListing — product-outofstock.html (real)', () => {
  const { listing } = parseLaboratoryListing(loadFixture('product-outofstock.html'));

  it('maps out-of-stock product and falls back to Product.sku for ISBN', () => {
    // Book.isbn is empty on this real page; the ISBN comes from Product.sku.
    expect(listing).toMatchObject({
      provider: 'laboratory',
      title: 'Абрикоси Донбасу',
      author: 'Любов Якимчук',
      isbn: '9789664481080',
      price: { amount: 35000, currency: 'UAH' },
      url: 'https://laboratory.ua/products/abrykosy-donbasu',
      availability: 'out-of-stock',
    });
  });

  it('resolves rawCategories from Book.genre (genres-taxonomy G2)', () => {
    expect(listing?.rawCategories).toEqual(['поезія']);
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratoryListing — ISBN cascade (Book.isbn → sku → mpn)
// ──────────────────────────────────────────────────────────────

describe('parseLaboratoryListing — ISBN handling', () => {
  const realInstock = loadFixture('product-instock.html');

  it('normalizes the Book.isbn', () => {
    expect(parseLaboratoryListing(realInstock).listing?.isbn).toBe('9786178621117');
  });

  it('yields isbn: null when every candidate (isbn/sku/mpn) is invalid', () => {
    // Break the checksum on all three identical 13-digit candidates at once.
    const html = realInstock.split('9786178621117').join('9786178621110');
    const { listing } = parseLaboratoryListing(html);
    expect(listing).not.toBeNull();
    expect(listing?.isbn).toBeNull();
  });

  it('falls back through sku to mpn when Book.isbn and sku are absent', () => {
    const html = productHtml({
      product: {
        '@type': 'Product',
        name: 'X',
        mpn: '9786178621117',
        offers: { '@type': 'AggregateOffer', price: '100', url: 'https://laboratory.ua/products/x' },
      },
      book: { '@type': 'Book', name: 'X', isbn: '' },
    });
    expect(parseLaboratoryListing(html).listing?.isbn).toBe('9786178621117');
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratoryListing — description handling (Product → Book cascade)
// ──────────────────────────────────────────────────────────────

describe('parseLaboratoryListing — description handling', () => {
  const base = {
    product: {
      '@type': 'Product',
      name: 'X',
      offers: { '@type': 'AggregateOffer', price: '100', url: 'https://laboratory.ua/products/x' },
    },
  };

  it('yields description: null when neither block carries one', () => {
    const html = productHtml({ ...base, book: { '@type': 'Book' } });
    expect(parseLaboratoryListing(html).listing?.description).toBeNull();
  });

  it('yields description: null when the description is blank', () => {
    const html = productHtml({
      product: { ...base.product, description: '   ' },
      book: { '@type': 'Book' },
    });
    expect(parseLaboratoryListing(html).listing?.description).toBeNull();
  });

  it('falls back to Book.description when Product.description is absent', () => {
    const html = productHtml({
      ...base,
      book: { '@type': 'Book', description: 'Опис із блоку Book.' },
    });
    expect(parseLaboratoryListing(html).listing?.description).toBe('Опис із блоку Book.');
  });

  it('prefers Product.description over Book.description', () => {
    const html = productHtml({
      product: { ...base.product, description: 'Опис із Product.' },
      book: { '@type': 'Book', description: 'Опис із Book.' },
    });
    expect(parseLaboratoryListing(html).listing?.description).toBe('Опис із Product.');
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratoryListing — author resolution
// ──────────────────────────────────────────────────────────────

describe('parseLaboratoryListing — author resolution', () => {
  const base = {
    product: {
      '@type': 'Product',
      name: 'X',
      offers: { '@type': 'AggregateOffer', price: '100', url: 'https://laboratory.ua/products/x' },
    },
  };

  it('joins an array of Person objects with ", "', () => {
    const html = productHtml({
      ...base,
      book: {
        '@type': 'Book',
        author: [
          { '@type': 'Person', name: 'Карл фон Клаузевіц' },
          { '@type': 'Person', name: 'Інший Автор' },
        ],
      },
    });
    expect(parseLaboratoryListing(html).listing?.author).toBe('Карл фон Клаузевіц, Інший Автор');
  });

  it('reads a plain-string author', () => {
    const html = productHtml({ ...base, book: { '@type': 'Book', author: 'Один Автор' } });
    expect(parseLaboratoryListing(html).listing?.author).toBe('Один Автор');
  });

  it('joins an array of plain strings', () => {
    const html = productHtml({ ...base, book: { '@type': 'Book', author: ['Автор А', 'Автор Б'] } });
    expect(parseLaboratoryListing(html).listing?.author).toBe('Автор А, Автор Б');
  });

  it('reads a single author object (not wrapped in an array)', () => {
    const html = productHtml({ ...base, book: { '@type': 'Book', author: { '@type': 'Person', name: 'Соло Автор' } } });
    expect(parseLaboratoryListing(html).listing?.author).toBe('Соло Автор');
  });

  it('yields author: null for an empty array or absent author', () => {
    const empty = productHtml({ ...base, book: { '@type': 'Book', author: [] } });
    expect(parseLaboratoryListing(empty).listing?.author).toBeNull();
    const absent = productHtml({ ...base, book: { '@type': 'Book' } });
    expect(parseLaboratoryListing(absent).listing?.author).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratoryListing — price / availability fallbacks
// ──────────────────────────────────────────────────────────────

describe('parseLaboratoryListing — price & availability', () => {
  const realInstock = loadFixture('product-instock.html');

  it('maps a zero price to price: null + out-of-stock (invariant)', () => {
    const html = realInstock.replace('"price": "990"', '"price": "0"');
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.price).toBeNull();
    expect(listing?.availability).toBe('out-of-stock');
  });

  it('maps a priced product with no availability field to unknown', () => {
    const html = realInstock.replace('"availability": "http://schema.org/InStock",', '');
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.price).not.toBeNull();
    expect(listing?.availability).toBe('unknown');
  });

  it('maps an unrecognized schema.org availability to unknown', () => {
    const html = realInstock.replace(
      'http://schema.org/InStock',
      'http://schema.org/LimitedAvailability',
    );
    expect(parseLaboratoryListing(html).listing?.availability).toBe('unknown');
  });

  it('maps OutOfStock → out-of-stock and PreOrder → in-stock', () => {
    const oos = realInstock.replace('http://schema.org/InStock', 'http://schema.org/OutOfStock');
    expect(parseLaboratoryListing(oos).listing?.availability).toBe('out-of-stock');
    const pre = realInstock.replace('http://schema.org/InStock', 'http://schema.org/PreOrder');
    expect(parseLaboratoryListing(pre).listing?.availability).toBe('in-stock');
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratoryListing — JSON-LD container shapes
// ──────────────────────────────────────────────────────────────

describe('parseLaboratoryListing — container shapes', () => {
  const product = {
    '@type': ['Product'], // array @type
    name: 'Контейнер',
    sku: '9786178621117',
    offers: { '@type': 'AggregateOffer', price: '250', availability: 'http://schema.org/InStock', url: 'https://laboratory.ua/products/k' },
  };
  const book = {
    '@type': 'Book',
    author: [{ '@type': 'Person', name: 'Автор' }],
    isbn: '9786178621117',
  };

  it('finds Product/Book when both share one array-typed JSON-LD block', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify([product, book])}</script></head></html>`;
    const { listing } = parseLaboratoryListing(html);
    expect(listing).toMatchObject({
      title: 'Контейнер',
      author: 'Автор',
      isbn: '9786178621117',
      price: { amount: 25000, currency: 'UAH' },
      availability: 'in-stock',
    });
  });

  it('finds Product/Book nested inside an @graph container', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({ '@graph': [product, book] })}</script></head></html>`;
    const { listing } = parseLaboratoryListing(html);
    expect(listing).toMatchObject({ title: 'Контейнер', author: 'Автор', availability: 'in-stock' });
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratoryListing — rawCategories: Book.genre vs breadcrumb microdata
// fallback (genres-taxonomy G2). product-instock.html carries both a
// Book.genre value and breadcrumb microdata; genre/breadcrumb are stripped
// from the real fixture in-memory to exercise each branch.
// ──────────────────────────────────────────────────────────────

describe('parseLaboratoryListing — rawCategories genre/breadcrumb fallback', () => {
  const realInstock = loadFixture('product-instock.html');

  function stripBreadcrumb(html: string): string {
    return html.replace(/<ol[^>]*breadcrumbs[^>]*>[\s\S]*?<\/ol>/, '');
  }

  it('genre wins when both Book.genre and breadcrumb are present', () => {
    const { listing } = parseLaboratoryListing(realInstock);
    expect(listing?.rawCategories).toEqual(['Військова справа']);
  });

  it('falls back to breadcrumb microdata when Book.genre is an empty string', () => {
    const html = realInstock.replace('"genre": "Військова справа"', '"genre": ""');
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.rawCategories).toEqual(['Каталог книжок', 'Нон-фікшн']);
  });

  it('falls back to breadcrumb microdata when Book.genre is absent', () => {
    const html = realInstock.replace('"genre": "Військова справа",', '');
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.rawCategories).toEqual(['Каталог книжок', 'Нон-фікшн']);
  });

  it('falls back to breadcrumb microdata when Book.genre is a malformed type (number)', () => {
    const html = realInstock.replace('"genre": "Військова справа"', '"genre": 123');
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.rawCategories).toEqual(['Каталог книжок', 'Нон-фікшн']);
  });

  it('uses Book.genre only when the breadcrumb is absent from the document', () => {
    const html = stripBreadcrumb(realInstock);
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.rawCategories).toEqual(['Військова справа']);
  });

  it('yields rawCategories: [] when both Book.genre and the breadcrumb are absent', () => {
    const html = stripBreadcrumb(realInstock).replace('"genre": "Військова справа",', '');
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.rawCategories).toEqual([]);
  });

  it('uses Book.genre array as-is (order preserved) when it has valid values', () => {
    const html = realInstock.replace('"genre": "Військова справа"', '"genre": ["Фентезі", "Пригоди"]');
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.rawCategories).toEqual(['Фентезі', 'Пригоди']);
    // Not the breadcrumb-fallback value — genre array won.
    expect(listing?.rawCategories).not.toEqual(['Каталог книжок', 'Нон-фікшн']);
  });

  it('cleans Book.genre array entries (trims, drops empty strings, dedupes)', () => {
    const html = realInstock.replace(
      '"genre": "Військова справа"',
      '"genre": ["Фентезі", "", "Фентезі", "  Пригоди  "]',
    );
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.rawCategories).toEqual(['Фентезі', 'Пригоди']);
  });

  it('falls back to breadcrumb microdata when Book.genre array cleans down to fully empty', () => {
    const html = realInstock.replace('"genre": "Військова справа"', '"genre": ["", "   "]');
    const { listing } = parseLaboratoryListing(html);
    expect(listing?.rawCategories).toEqual(['Каталог книжок', 'Нон-фікшн']);
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratoryListing — error branches (never thrown)
// ──────────────────────────────────────────────────────────────

describe('parseLaboratoryListing — error handling', () => {
  it('returns listing: null + error when no JSON-LD is present', () => {
    const { listing, errors } = parseLaboratoryListing('<html><head></head><body></body></html>');
    expect(listing).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns listing: null + error when no Product/Book block is present', () => {
    const html = productHtml({ product: { '@type': 'Organization', name: 'Лабораторія' } });
    const { listing, errors } = parseLaboratoryListing(html);
    expect(listing).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });

  it('records malformed JSON-LD without throwing', () => {
    const html =
      '<html><head><script type="application/ld+json">{ "@type": "Product", broken }</script></head></html>';
    const { listing, errors } = parseLaboratoryListing(html);
    expect(listing).toBeNull();
    expect(errors.some((e) => e.includes('malformed JSON-LD'))).toBe(true);
  });

  it('skips a product missing its name (both blocks blanked)', () => {
    const html = loadFixture('product-instock.html').split('"name": "Про війну"').join('"name": ""');
    const { listing, errors } = parseLaboratoryListing(html);
    expect(listing).toBeNull();
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('skips a product missing its url (offers.url + Book.url blanked)', () => {
    const html = loadFixture('product-instock.html')
      .split('"url": "https://laboratory.ua/products/pro-vijnu"')
      .join('"url": ""');
    const { listing, errors } = parseLaboratoryListing(html);
    expect(listing).toBeNull();
    expect(errors.some((e) => e.includes('url'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// parseLaboratoryProduct — single-product price/availability state
// ──────────────────────────────────────────────────────────────

describe('parseLaboratoryProduct', () => {
  it('reads price + availability from a real in-stock page', () => {
    expect(parseLaboratoryProduct(loadFixture('product-instock.html'))).toEqual({
      price: { amount: 99000, currency: 'UAH' },
      availability: 'in-stock',
    });
  });

  it('reads out-of-stock state from a real page', () => {
    expect(parseLaboratoryProduct(loadFixture('product-outofstock.html'))).toEqual({
      price: { amount: 35000, currency: 'UAH' },
      availability: 'out-of-stock',
    });
  });

  it('returns { price: null, availability: unknown } when no Product JSON-LD', () => {
    expect(parseLaboratoryProduct('<html><head></head><body></body></html>')).toEqual({
      price: null,
      availability: 'unknown',
    });
  });

  it('returns { price: null, availability: out-of-stock } when price is absent', () => {
    const html = loadFixture('product-instock.html').replace('"price": "990"', '"price": "0"');
    expect(parseLaboratoryProduct(html)).toEqual({ price: null, availability: 'out-of-stock' });
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
    expect(buildCoverUrl('/files/a.jpg')).toBe('https://laboratory.ua/files/a.jpg');
  });

  it('prefixes a bare relative path with base URL + slash', () => {
    expect(buildCoverUrl('files/a.jpg')).toBe('https://laboratory.ua/files/a.jpg');
  });

  it('upgrades a protocol-relative URL to https', () => {
    expect(buildCoverUrl('//cdn.x/a.jpg')).toBe('https://cdn.x/a.jpg');
  });

  it('takes the first usable string from an array', () => {
    expect(buildCoverUrl(['', '/files/a.jpg'])).toBe('https://laboratory.ua/files/a.jpg');
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
    expect(buildProductUrl('pro-vijnu')).toBe('https://laboratory.ua/pro-vijnu');
  });

  it('trims leading slashes', () => {
    expect(buildProductUrl('/pro-vijnu')).toBe('https://laboratory.ua/pro-vijnu');
  });
});

describe('isPaperBookType', () => {
  it('treats missing / blank format as paper', () => {
    expect(isPaperBookType(undefined)).toBe(true);
    expect(isPaperBookType('')).toBe(true);
  });

  it('treats Hardcover / Paperback as paper', () => {
    expect(isPaperBookType('https://schema.org/Hardcover')).toBe(true);
    expect(isPaperBookType('https://schema.org/Paperback')).toBe(true);
  });

  it('flags non-paper formats (EBook / Audiobook)', () => {
    expect(isPaperBookType('https://schema.org/EBook')).toBe(false);
    expect(isPaperBookType('https://schema.org/AudiobookFormat')).toBe(false);
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
    expect(normalizeIsbn('9786178621117')).toBe('9786178621117');
  });

  it('returns null for invalid / unparseable input', () => {
    expect(normalizeIsbn('INVALID')).toBeNull();
    expect(normalizeIsbn('9786178621110')).toBeNull(); // bad checksum
    expect(normalizeIsbn(null)).toBeNull();
  });
});
