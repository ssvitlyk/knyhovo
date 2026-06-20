import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseBookYePage, bookYePriceToKopecks } from '../book-ye.parser.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

// ──────────────────────────────────────────────────────────────
// bookYePriceToKopecks
// ──────────────────────────────────────────────────────────────

describe('bookYePriceToKopecks', () => {
  it('scales whole hryvnias to kopecks', () => {
    expect(bookYePriceToKopecks('550')).toBe(55000);
  });

  it('rounds fractional hryvnias', () => {
    expect(bookYePriceToKopecks('199.5')).toBe(19950);
  });

  it('trims surrounding whitespace', () => {
    expect(bookYePriceToKopecks('  350 ')).toBe(35000);
  });

  it('returns null for zero', () => {
    expect(bookYePriceToKopecks('0')).toBeNull();
  });

  it('returns null for a negative value', () => {
    expect(bookYePriceToKopecks('-100')).toBeNull();
  });

  it('returns null for a non-numeric string', () => {
    expect(bookYePriceToKopecks('abc')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(bookYePriceToKopecks(undefined)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseBookYePage — catalog-page.html (standard page)
// ──────────────────────────────────────────────────────────────

describe('parseBookYePage — catalog-page.html', () => {
  const html = loadFixture('catalog-page.html');

  it('returns 3 listings (electronic title filtered out)', () => {
    const { listings } = parseBookYePage(html);
    expect(listings).toHaveLength(3);
  });

  it('all listings have provider = book-ye', () => {
    const { listings } = parseBookYePage(html);
    for (const l of listings) expect(l.provider).toBe('book-ye');
  });

  it('all listings have isbn = null (catalog cards have no ISBN)', () => {
    const { listings } = parseBookYePage(html);
    for (const l of listings) expect(l.isbn).toBeNull();
  });

  it('parses a discounted in-stock book using the final price', () => {
    const { listings } = parseBookYePage(html);
    const korol = listings[0]!;
    expect(korol.title).toBe('Король шрамів');
    expect(korol.author).toBe('Лі Бардуґо');
    // final (special) price 550, NOT the old price 736
    expect(korol.price).toEqual({ amount: 55000, currency: 'UAH' });
    expect(korol.url).toBe('https://book-ye.com.ua/khudozhnya-literatura/fentezi/korol-shramiv/');
    expect(korol.availability).toBe('in-stock');
  });

  it('treats a preorder card as in-stock', () => {
    const { listings } = parseBookYePage(html);
    const imperiia = listings[1]!;
    expect(imperiia.title).toBe('Імперія штормів');
    expect(imperiia.author).toBe('Сара Дж. Маас');
    expect(imperiia.price).toEqual({ amount: 74900, currency: 'UAH' });
    expect(imperiia.availability).toBe('in-stock');
  });

  it('maps a card with only a publisher (no author) to author null', () => {
    const { listings } = parseBookYePage(html);
    const antologiia = listings[2]!;
    expect(antologiia.title).toBe('Антологія сучасної поезії');
    expect(antologiia.author).toBeNull();
  });

  it('skips a non-physical (electronic) title without an error', () => {
    const { listings } = parseBookYePage(html);
    expect(listings.some((l) => l.title.includes('Електронна'))).toBe(false);
  });

  it('returns no errors for a clean page', () => {
    const { errors } = parseBookYePage(html);
    expect(errors).toHaveLength(0);
  });

  it('hasNextPage is true when cards were found', () => {
    const { hasNextPage } = parseBookYePage(html);
    expect(hasNextPage).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// parseBookYePage — catalog-invalid-price.html
// ──────────────────────────────────────────────────────────────

describe('parseBookYePage — catalog-invalid-price.html', () => {
  const html = loadFixture('catalog-invalid-price.html');

  it('returns 3 listings (all paper cards included even with null price)', () => {
    const { listings } = parseBookYePage(html);
    expect(listings).toHaveLength(3);
  });

  it('zero price → price null and availability out-of-stock, with no error', () => {
    const { listings, errors } = parseBookYePage(html);
    const prychynna = listings[0]!;
    expect(prychynna.title).toBe('Причинна');
    expect(prychynna.price).toBeNull();
    expect(prychynna.availability).toBe('out-of-stock');
    expect(errors.some((e) => e.includes('prychynna'))).toBe(false);
  });

  it('out-of-stock keyword → availability out-of-stock even when priced', () => {
    const { listings } = parseBookYePage(html);
    const lisova = listings[1]!;
    expect(lisova.title).toBe('Лісова пісня');
    expect(lisova.price).toEqual({ amount: 25000, currency: 'UAH' });
    expect(lisova.availability).toBe('out-of-stock');
  });

  it('non-numeric price → price null, out-of-stock, and records an error', () => {
    const { listings, errors } = parseBookYePage(html);
    const marusia = listings[2]!;
    expect(marusia.title).toBe('Маруся');
    expect(marusia.price).toBeNull();
    expect(marusia.availability).toBe('out-of-stock');
    expect(errors.some((e) => e.includes('unparseable price'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// parseBookYePage — catalog-empty.html
// ──────────────────────────────────────────────────────────────

describe('parseBookYePage — catalog-empty.html', () => {
  const html = loadFixture('catalog-empty.html');

  it('returns empty listings array', () => {
    const { listings } = parseBookYePage(html);
    expect(listings).toHaveLength(0);
  });

  it('returns no errors', () => {
    const { errors } = parseBookYePage(html);
    expect(errors).toHaveLength(0);
  });

  it('hasNextPage is false when no cards found', () => {
    const { hasNextPage } = parseBookYePage(html);
    expect(hasNextPage).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// parseBookYePage — malformed input
// ──────────────────────────────────────────────────────────────

describe('parseBookYePage — malformed input', () => {
  it('returns empty with no error when there are no cards', () => {
    const { listings, errors, hasNextPage } = parseBookYePage('<html><body></body></html>');
    expect(listings).toHaveLength(0);
    expect(errors).toHaveLength(0);
    expect(hasNextPage).toBe(false);
  });

  it('skips a card missing its href', () => {
    const html =
      '<li class="product-item"><strong class="product-item-name"><a class="product-item-link" title="No link">No link</a></strong></li>';
    const { listings, errors } = parseBookYePage(html);
    expect(listings).toHaveLength(0);
    expect(errors.some((e) => e.includes('missing href'))).toBe(true);
  });

  it('skips a card missing its title', () => {
    const html =
      '<li class="product-item"><strong class="product-item-name"><a class="product-item-link" href="/x/"></a></strong></li>';
    const { listings, errors } = parseBookYePage(html);
    expect(listings).toHaveLength(0);
    expect(errors.some((e) => e.includes('missing title'))).toBe(true);
  });

  it('a card with no price box → price null and out-of-stock', () => {
    const html =
      '<li class="product-item"><strong class="product-item-name"><a class="product-item-link" href="/x/" title="No price">No price</a></strong></li>';
    const { listings } = parseBookYePage(html);
    expect(listings).toHaveLength(1);
    expect(listings[0]!.price).toBeNull();
    expect(listings[0]!.availability).toBe('out-of-stock');
  });
});

// ──────────────────────────────────────────────────────────────
// parseBookYePage — cover extraction (W9a F1)
// ──────────────────────────────────────────────────────────────

describe('parseBookYePage — cover extraction', () => {
  function cardHtml(imgTag: string): string {
    return `<li class="product-item"><div class="product-item-info">
      <a class="product-item-photo" href="/x/">${imgTag}</a>
      <strong class="product-item-name"><a class="product-item-link" href="/x/" title="Книга">Книга</a></strong>
      <span data-price-amount="100" data-price-type="finalPrice"></span>
    </div></li>`;
  }

  it('extracts the absolute cover URL from the card image', () => {
    const { listings } = parseBookYePage(loadFixture('catalog-page.html'));
    expect(listings[0]!.coverUrl).toBe(
      'https://book-ye.com.ua/media/catalog/product/korol-shramiv.jpg',
    );
  });

  it('falls back to data-src and resolves a relative path to an absolute URL', () => {
    const { listings } = parseBookYePage(loadFixture('catalog-page.html'));
    // Антологія сучасної поезії uses a relative data-src in the fixture.
    expect(listings[2]!.coverUrl).toBe(
      'https://book-ye.com.ua/media/catalog/product/antologiia-poezii.jpg',
    );
  });

  it('returns null cover when the card has no image (in-fixture: Імперія штормів)', () => {
    const { listings } = parseBookYePage(loadFixture('catalog-page.html'));
    expect(listings[1]!.title).toBe('Імперія штормів');
    expect(listings[1]!.coverUrl).toBeNull();
  });

  it('resolves a protocol-relative cover src to https', () => {
    const { listings } = parseBookYePage(
      cardHtml('<img class="product-image-photo" src="//cdn.example/x.jpg">'),
    );
    expect(listings[0]!.coverUrl).toBe('https://cdn.example/x.jpg');
  });

  it('returns null cover when the card has no image element (missing cover never breaks the listing)', () => {
    const { listings } = parseBookYePage(cardHtml(''));
    expect(listings).toHaveLength(1);
    expect(listings[0]!.coverUrl).toBeNull();
  });
});
