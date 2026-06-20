import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseYakabooPage, parsePriceAsKopecks } from '../yakaboo.parser.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

// ──────────────────────────────────────────────────────────────
// parsePriceAsKopecks
// ──────────────────────────────────────────────────────────────

describe('parsePriceAsKopecks', () => {
  it('parses whole hryvnias', () => {
    expect(parsePriceAsKopecks('620 грн')).toBe(62000);
  });

  it('parses price with space as thousands separator', () => {
    expect(parsePriceAsKopecks('2 450 грн')).toBe(245000);
  });

  it('parses price with comma decimal separator', () => {
    expect(parsePriceAsKopecks('199,50 грн')).toBe(19950);
  });

  it('parses discounted price', () => {
    expect(parsePriceAsKopecks('1360 грн')).toBe(136000);
  });

  it('returns null for empty string', () => {
    expect(parsePriceAsKopecks('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parsePriceAsKopecks('   ')).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parsePriceAsKopecks('Ціна уточнюється')).toBeNull();
  });

  it('returns null for negative value', () => {
    expect(parsePriceAsKopecks('-100 грн')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseYakabooPage — catalog-page.html (standard page)
// ──────────────────────────────────────────────────────────────

describe('parseYakabooPage — catalog-page.html', () => {
  const html = loadFixture('catalog-page.html');

  it('returns 4 listings', () => {
    const { listings } = parseYakabooPage(html);
    expect(listings).toHaveLength(4);
  });

  it('all listings have provider = yakaboo', () => {
    const { listings } = parseYakabooPage(html);
    for (const l of listings) expect(l.provider).toBe('yakaboo');
  });

  it('all listings have isbn = null (catalog cards do not expose ISBN)', () => {
    const { listings } = parseYakabooPage(html);
    for (const l of listings) expect(l.isbn).toBeNull();
  });

  it('parses in-stock book correctly', () => {
    const { listings } = parseYakabooPage(html);
    const kobzar = listings[0]!;
    expect(kobzar.title).toBe('Кобзар');
    expect(kobzar.author).toBe('Тарас Шевченко');
    expect(kobzar.price).toEqual({ amount: 34900, currency: 'UAH' });
    expect(kobzar.url).toBe('https://www.yakaboo.ua/kobzar-1234567.html');
    expect(kobzar.availability).toBe('in-stock');
  });

  it('parses discounted book with creators-label author', () => {
    const { listings } = parseYakabooPage(html);
    const taemna = listings[1]!;
    expect(taemna.title).toBe('Таємна Історія');
    expect(taemna.author).toBe('Донна Тартт');
    expect(taemna.price).toEqual({ amount: 40000, currency: 'UAH' });
    expect(taemna.availability).toBe('in-stock');
  });

  it('parses out-of-stock book: price is null, availability is out-of-stock', () => {
    const { listings } = parseYakabooPage(html);
    const majster = listings[2]!;
    expect(majster.title).toBe('Майстер і Маргарита');
    expect(majster.price).toBeNull();
    expect(majster.availability).toBe('out-of-stock');
  });

  it('strips "Книга " prefix from title', () => {
    const { listings } = parseYakabooPage(html);
    const book4 = listings[3]!;
    expect(book4.title).toBe('Пані Довгорукавиця та її пригоди');
  });

  it('parses decimal price correctly (199,50 грн → 19950 kopecks)', () => {
    const { listings } = parseYakabooPage(html);
    const book4 = listings[3]!;
    expect(book4.price).toEqual({ amount: 19950, currency: 'UAH' });
  });

  it('returns no errors for a clean page', () => {
    const { errors } = parseYakabooPage(html);
    expect(errors).toHaveLength(0);
  });

  it('hasNextPage is true when cards were found', () => {
    const { hasNextPage } = parseYakabooPage(html);
    expect(hasNextPage).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// parseYakabooPage — catalog-invalid-price.html
// ──────────────────────────────────────────────────────────────

describe('parseYakabooPage — catalog-invalid-price.html', () => {
  const html = loadFixture('catalog-invalid-price.html');

  it('returns 3 listings (all cards are included even with null price)', () => {
    const { listings } = parseYakabooPage(html);
    expect(listings).toHaveLength(3);
  });

  it('book with whitespace-only price has price = null', () => {
    const { listings } = parseYakabooPage(html);
    const prychynna = listings[0]!;
    expect(prychynna.title).toBe('Причинна');
    expect(prychynna.price).toBeNull();
  });

  it('book with whitespace-only price but status В наявності → availability unknown (no price = no confidence)', () => {
    const { listings } = parseYakabooPage(html);
    const prychynna = listings[0]!;
    expect(prychynna.availability).toBe('out-of-stock');
  });

  it('book with non-numeric price text has price = null and error logged', () => {
    const { listings, errors } = parseYakabooPage(html);
    const zakhyst = listings[1]!;
    expect(zakhyst.title).toBe('Захист Лужина');
    expect(zakhyst.price).toBeNull();
    expect(errors.some((e) => e.includes('Захист') || e.includes('Ціна уточнюється'))).toBe(true);
  });

  it('out-of-stock book (no price container) has price = null and availability = out-of-stock', () => {
    const { listings } = parseYakabooPage(html);
    const lisova = listings[2]!;
    expect(lisova.title).toBe('Лісова пісня');
    expect(lisova.price).toBeNull();
    expect(lisova.availability).toBe('out-of-stock');
  });
});

// ──────────────────────────────────────────────────────────────
// parseYakabooPage — catalog-empty.html
// ──────────────────────────────────────────────────────────────

describe('parseYakabooPage — catalog-empty.html', () => {
  const html = loadFixture('catalog-empty.html');

  it('returns empty listings array', () => {
    const { listings } = parseYakabooPage(html);
    expect(listings).toHaveLength(0);
  });

  it('returns no errors', () => {
    const { errors } = parseYakabooPage(html);
    expect(errors).toHaveLength(0);
  });

  it('hasNextPage is false when no cards found', () => {
    const { hasNextPage } = parseYakabooPage(html);
    expect(hasNextPage).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// parseYakabooPage — minimal inline HTML
// ──────────────────────────────────────────────────────────────

describe('parseYakabooPage — minimal inline HTML', () => {
  it('returns empty listings for completely empty HTML', () => {
    const { listings } = parseYakabooPage('<html><body></body></html>');
    expect(listings).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
// parseYakabooPage — cover extraction (W9a F1)
// ──────────────────────────────────────────────────────────────

describe('parseYakabooPage — cover extraction', () => {
  function cardHtml(inner: string): string {
    return `<div class="category-card category-layout">
      <a href="/some-book-1.html" class="category-card__image">${inner}</a>
      <a class="ui-card-title category-card__name">Якась цікава книга</a>
      <div class="product-price">100 грн</div>
    </div>`;
  }

  it('extracts the absolute cover URL from the catalog card image', () => {
    const { listings } = parseYakabooPage(loadFixture('catalog-page.html'));
    expect(listings[0]!.coverUrl).toBe(
      'https://static.yakaboo.ua/media/cloudflare/product/webp/352x340/kobzar.jpg',
    );
  });

  it('every listing on the standard page has a cover URL', () => {
    const { listings } = parseYakabooPage(loadFixture('catalog-page.html'));
    for (const l of listings) expect(l.coverUrl).not.toBeNull();
  });

  it('resolves a relative cover src to an absolute Yakaboo URL', () => {
    const { listings } = parseYakabooPage(cardHtml('<img src="/media/rel.jpg">'));
    expect(listings[0]!.coverUrl).toBe('https://www.yakaboo.ua/media/rel.jpg');
  });

  it('resolves a protocol-relative cover src to https', () => {
    const { listings } = parseYakabooPage(cardHtml('<img src="//static.yakaboo.ua/x.jpg">'));
    expect(listings[0]!.coverUrl).toBe('https://static.yakaboo.ua/x.jpg');
  });

  it('falls back to data-src when src is absent (lazy-loaded image)', () => {
    const { listings } = parseYakabooPage(cardHtml('<img data-src="https://cdn.example/lazy.jpg">'));
    expect(listings[0]!.coverUrl).toBe('https://cdn.example/lazy.jpg');
  });

  it('returns null cover when the card has no image (missing cover never breaks the listing)', () => {
    const { listings } = parseYakabooPage(cardHtml(''));
    expect(listings).toHaveLength(1);
    expect(listings[0]!.coverUrl).toBeNull();
  });
});
