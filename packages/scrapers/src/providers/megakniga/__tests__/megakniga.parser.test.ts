import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  parseMegaknigaListing,
  megaknigaPriceToKopecks,
  extractMegaknigaProductDetails,
} from '../megakniga.parser.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

// ──────────────────────────────────────────────────────────────
// megaknigaPriceToKopecks
// ──────────────────────────────────────────────────────────────

describe('megaknigaPriceToKopecks', () => {
  it('scales a decimal hryvnia string to kopecks', () => {
    expect(megaknigaPriceToKopecks('432.10')).toBe(43210);
  });

  it('scales a whole-number string', () => {
    expect(megaknigaPriceToKopecks('270')).toBe(27000);
  });

  it('scales a plain number', () => {
    expect(megaknigaPriceToKopecks(270.1)).toBe(27010);
  });

  it('trims surrounding whitespace (as seen in .price element text)', () => {
    expect(megaknigaPriceToKopecks('  270.10                    ')).toBe(27010);
  });

  it('returns null for zero', () => {
    expect(megaknigaPriceToKopecks('0')).toBeNull();
    expect(megaknigaPriceToKopecks(0)).toBeNull();
  });

  it('returns null for a negative value', () => {
    expect(megaknigaPriceToKopecks('-1')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(megaknigaPriceToKopecks('—')).toBeNull();
    expect(megaknigaPriceToKopecks(undefined)).toBeNull();
    expect(megaknigaPriceToKopecks(null)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseMegaknigaListing — catalog-page.html (root /catalog/knigi listing)
// ──────────────────────────────────────────────────────────────

describe('parseMegaknigaListing — catalog-page.html', () => {
  const html = loadFixture('catalog-page.html');

  it('returns all 6 cards', () => {
    const { listings } = parseMegaknigaListing(html);
    expect(listings).toHaveLength(6);
  });

  it('all listings have provider = megakniga and isbn = null', () => {
    const { listings } = parseMegaknigaListing(html);
    for (const l of listings) {
      expect(l.provider).toBe('megakniga');
      expect(l.isbn).toBeNull();
    }
  });

  it('parses title, author, price, url, availability and cover from a plain card', () => {
    const { listings } = parseMegaknigaListing(html);
    const first = listings[0]!;
    expect(first.title).toBe('Теологічно-політичний трактат');
    expect(first.author).toBe('Спіноза');
    expect(first.price).toEqual({ amount: 27010, currency: 'UAH' });
    expect(first.url).toBe(
      'https://www.megakniga.com.ua/catalog/knigi/proza/klasika/teolohichno-politychnyi-traktat.html',
    );
    expect(first.availability).toBe('in-stock');
    expect(first.coverUrl).toBe(
      'https://www.megakniga.com.ua/uploads/cache/Products/Product_images_2810158/c1f61c_h286.jpg',
    );
  });

  it('takes the discounted (current) price, never the old price', () => {
    const { listings } = parseMegaknigaListing(html);
    const discounted = listings[1]!;
    expect(discounted.title).toContain('Батькам про дитячі вікові кризи');
    // data-price="219.00"; .price.price-old = 350.00 must be ignored.
    expect(discounted.price).toEqual({ amount: 21900, currency: 'UAH' });
  });

  it('returns no errors for a clean page', () => {
    const { errors } = parseMegaknigaListing(html);
    expect(errors).toHaveLength(0);
  });

  it('hasNextPage is true when cards were found', () => {
    const { hasNextPage } = parseMegaknigaListing(html);
    expect(hasNextPage).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// parseMegaknigaListing — catalog-page-2.html (subcategory listing, distinct URLs)
// ──────────────────────────────────────────────────────────────

describe('parseMegaknigaListing — catalog-page-2.html', () => {
  const html = loadFixture('catalog-page-2.html');

  it('returns 4 cards with distinct urls from catalog-page.html', () => {
    const { listings } = parseMegaknigaListing(html);
    expect(listings).toHaveLength(4);
    expect(listings[0]!.title).toBe('Енеїда Вергілій');
    expect(listings[0]!.author).toBe('Вергілій');
    expect(listings[0]!.price).toEqual({ amount: 20840, currency: 'UAH' });
  });
});

// ──────────────────────────────────────────────────────────────
// parseMegaknigaListing — catalog-empty.html
// ──────────────────────────────────────────────────────────────

describe('parseMegaknigaListing — catalog-empty.html', () => {
  const html = loadFixture('catalog-empty.html');

  it('returns empty listings, no errors, hasNextPage false', () => {
    const { listings, errors, hasNextPage } = parseMegaknigaListing(html);
    expect(listings).toHaveLength(0);
    expect(errors).toHaveLength(0);
    expect(hasNextPage).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// parseMegaknigaListing — catalog-invalid-price.html
// ──────────────────────────────────────────────────────────────

describe('parseMegaknigaListing — catalog-invalid-price.html', () => {
  const html = loadFixture('catalog-invalid-price.html');

  it('invalid data-price and invalid .price text → price null, availability out-of-stock', () => {
    const { listings } = parseMegaknigaListing(html);
    expect(listings).toHaveLength(1);
    expect(listings[0]!.price).toBeNull();
    expect(listings[0]!.availability).toBe('out-of-stock');
  });

  it('is not blocked at parse time (guide §2.9 — a priceless listing is still valid)', () => {
    const { listings, errors } = parseMegaknigaListing(html);
    expect(listings).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
// parseMegaknigaListing — availability markers
// ──────────────────────────────────────────────────────────────

describe('parseMegaknigaListing — availability markers', () => {
  it('"Товар очікується" text → out-of-stock even though priced', () => {
    const { listings } = parseMegaknigaListing(loadFixture('catalog-out-of-stock.html'));
    expect(listings).toHaveLength(1);
    expect(listings[0]!.price).not.toBeNull();
    expect(listings[0]!.availability).toBe('out-of-stock');
  });

  it('neither in_stock class nor a known text marker → unknown', () => {
    const { listings } = parseMegaknigaListing(loadFixture('catalog-unknown-availability.html'));
    expect(listings).toHaveLength(1);
    expect(listings[0]!.price).not.toBeNull();
    expect(listings[0]!.availability).toBe('unknown');
  });
});

// ──────────────────────────────────────────────────────────────
// parseMegaknigaListing — malformed / edge-case cards (inline HTML, vivat pattern)
// ──────────────────────────────────────────────────────────────

describe('parseMegaknigaListing — edge cases', () => {
  function cardHtml(inner: string): string {
    return `<div class="product-items-cont items-cont clear-after"><div class="product-list-item">${inner}</div></div>`;
  }

  it('maps a missing author block to null', () => {
    const html = cardHtml(
      '<a class="product-list-name" href="/catalog/knigi/x.html">Title</a>' +
        '<form data-price="100.00"></form>' +
        '<div class="product-available-container in_stock">Є в наявності</div>',
    );
    const { listings } = parseMegaknigaListing(html);
    expect(listings).toHaveLength(1);
    expect(listings[0]!.author).toBeNull();
  });

  it('missing url → skipped with an error', () => {
    const html = cardHtml('<span class="product-list-name">No link</span>');
    const { listings, errors } = parseMegaknigaListing(html);
    expect(listings).toHaveLength(0);
    expect(errors.some((e) => e.includes('missing url'))).toBe(true);
  });

  it('missing title → skipped with an error', () => {
    const html = cardHtml('<a class="product-list-name" href="/catalog/knigi/x.html"></a>');
    const { listings, errors } = parseMegaknigaListing(html);
    expect(listings).toHaveLength(0);
    expect(errors.some((e) => e.includes('missing title'))).toBe(true);
  });

  it('missing cover image → coverUrl null (never breaks the listing)', () => {
    const html = cardHtml(
      '<a class="product-list-name" href="/catalog/knigi/x.html">Title</a>' +
        '<form data-price="100.00"></form>' +
        '<div class="product-available-container in_stock">Є в наявності</div>',
    );
    const { listings } = parseMegaknigaListing(html);
    expect(listings[0]!.coverUrl).toBeNull();
  });

  it('a relative url is resolved to an absolute megakniga.com.ua URL', () => {
    const html = cardHtml(
      '<a class="product-list-name" href="/catalog/knigi/x.html">Title</a>' +
        '<form data-price="100.00"></form>',
    );
    const { listings } = parseMegaknigaListing(html);
    expect(listings[0]!.url).toBe('https://www.megakniga.com.ua/catalog/knigi/x.html');
  });
});

// ──────────────────────────────────────────────────────────────
// extractMegaknigaProductDetails — product-in-stock.html (Енеїда)
// ──────────────────────────────────────────────────────────────

describe('extractMegaknigaProductDetails — product-in-stock.html', () => {
  const html = loadFixture('product-in-stock.html');

  it('extracts ISBN from mpn/identifier microdata', () => {
    const { metadata } = extractMegaknigaProductDetails(html);
    expect(metadata?.isbn).toBe('9786178493974');
  });

  it('extracts publisher from "Виробник:" text, not itemprop=brand', () => {
    const { metadata } = extractMegaknigaProductDetails(html);
    expect(metadata?.publisher).toBe('Фоліо');
  });

  it('extracts format from "Обкладинка:" text', () => {
    const { metadata } = extractMegaknigaProductDetails(html);
    expect(metadata?.format).toBe("М'яка");
  });

  it('extracts a sanitized description from the "Опис товару" block', () => {
    const { description } = extractMegaknigaProductDetails(html);
    expect(description).toContain('Публій Вергілій Марон');
  });

  it('extracts rawCategories from the breadcrumb, excluding Головна/Каталог and the product leaf', () => {
    const { rawCategories } = extractMegaknigaProductDetails(html);
    expect(rawCategories).toEqual(['Книги', 'Художня література', 'Українська літ-ра до 1991 року']);
  });

  it('language/series/publicationYear stay null (source limitation)', () => {
    const { metadata } = extractMegaknigaProductDetails(html);
    expect(metadata?.language).toBeNull();
    expect(metadata?.series).toBeNull();
    expect(metadata?.publicationYear).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// extractMegaknigaProductDetails — product-out-of-stock.html (Дитячий кобзар)
// ──────────────────────────────────────────────────────────────

describe('extractMegaknigaProductDetails — product-out-of-stock.html', () => {
  const html = loadFixture('product-out-of-stock.html');

  it('extracts ISBN, publisher and format for a different book', () => {
    const { metadata } = extractMegaknigaProductDetails(html);
    expect(metadata?.isbn).toBe('9789662909944');
    expect(metadata?.publisher).toBe('ВСЛ');
    expect(metadata?.format).toBe('Тверда');
  });
});

// ──────────────────────────────────────────────────────────────
// extractMegaknigaProductDetails — non-book pages and ISBN fallback
// ──────────────────────────────────────────────────────────────

describe('extractMegaknigaProductDetails — non-book page', () => {
  it('a page without the "Паперова книга" marker yields null description and metadata', () => {
    const { description, metadata, rawCategories } = extractMegaknigaProductDetails(
      loadFixture('product-non-book.html'),
    );
    expect(description).toBeNull();
    expect(metadata).toBeNull();
    expect(rawCategories).toBeUndefined();
  });
});

describe('extractMegaknigaProductDetails — ISBN text fallback', () => {
  it('falls back to the "Код товару / ISBN:" text when mpn/identifier microdata is absent', () => {
    const { metadata } = extractMegaknigaProductDetails(loadFixture('product-isbn-text-fallback.html'));
    expect(metadata?.isbn).toBe('9789662909944');
  });
});

describe('extractMegaknigaProductDetails — malformed input', () => {
  it('never throws on empty/garbage HTML', () => {
    expect(() => extractMegaknigaProductDetails('')).not.toThrow();
    expect(() => extractMegaknigaProductDetails('<html><body></body></html>')).not.toThrow();
  });

  it('returns null description/metadata for a page with no paper-book marker at all', () => {
    const { description, metadata } = extractMegaknigaProductDetails('<html><body><p>hi</p></body></html>');
    expect(description).toBeNull();
    expect(metadata).toBeNull();
  });
});
