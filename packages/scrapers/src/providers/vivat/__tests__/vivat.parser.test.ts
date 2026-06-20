import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseVivatPage, vivatPriceToKopecks } from '../vivat.parser.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

// ──────────────────────────────────────────────────────────────
// vivatPriceToKopecks
// ──────────────────────────────────────────────────────────────

describe('vivatPriceToKopecks', () => {
  it('scales whole hryvnias to kopecks', () => {
    expect(vivatPriceToKopecks(499)).toBe(49900);
  });

  it('scales a promotion price', () => {
    expect(vivatPriceToKopecks(636)).toBe(63600);
  });

  it('rounds fractional hryvnias', () => {
    expect(vivatPriceToKopecks(199.5)).toBe(19950);
  });

  it('returns null for zero', () => {
    expect(vivatPriceToKopecks(0)).toBeNull();
  });

  it('returns null for negative value', () => {
    expect(vivatPriceToKopecks(-100)).toBeNull();
  });

  it('returns null for non-number input', () => {
    expect(vivatPriceToKopecks('499')).toBeNull();
    expect(vivatPriceToKopecks(null)).toBeNull();
    expect(vivatPriceToKopecks(undefined)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// parseVivatPage — catalog-page.html (standard page)
// ──────────────────────────────────────────────────────────────

describe('parseVivatPage — catalog-page.html', () => {
  const html = loadFixture('catalog-page.html');

  it('returns 3 listings (electronic bookType filtered out)', () => {
    const { listings } = parseVivatPage(html);
    expect(listings).toHaveLength(3);
  });

  it('all listings have provider = vivat', () => {
    const { listings } = parseVivatPage(html);
    for (const l of listings) expect(l.provider).toBe('vivat');
  });

  it('all listings have isbn = null (catalog payload has no ISBN)', () => {
    const { listings } = parseVivatPage(html);
    for (const l of listings) expect(l.isbn).toBeNull();
  });

  it('parses an in-stock book correctly', () => {
    const { listings } = parseVivatPage(html);
    const korol = listings[0]!;
    expect(korol.title).toBe('Король шрамів');
    expect(korol.author).toBe('Лі Бардуґо');
    expect(korol.price).toEqual({ amount: 49900, currency: 'UAH' });
    expect(korol.url).toBe('https://vivat.com.ua/product/korol-shramiv/');
    expect(korol.availability).toBe('in-stock');
  });

  it('uses the promotion price over retail, and treats preorder as in-stock', () => {
    const { listings } = parseVivatPage(html);
    const imperiia = listings[1]!;
    expect(imperiia.title).toBe('Імперія штормів');
    expect(imperiia.author).toBe('Сара Джанет Маас');
    // promotion 636 → 63600, NOT retail 749 → 74900
    expect(imperiia.price).toEqual({ amount: 63600, currency: 'UAH' });
    expect(imperiia.availability).toBe('in-stock');
  });

  it('maps an empty author array to null', () => {
    const { listings } = parseVivatPage(html);
    const antologiia = listings[2]!;
    expect(antologiia.title).toBe('Антологія сучасної поезії');
    expect(antologiia.author).toBeNull();
  });

  it('skips non-paper bookType (electronic) without an error', () => {
    const { listings } = parseVivatPage(html);
    expect(listings.some((l) => l.title.includes('Електронна'))).toBe(false);
  });

  it('returns no errors for a clean page', () => {
    const { errors } = parseVivatPage(html);
    expect(errors).toHaveLength(0);
  });

  it('hasNextPage is true when products were found', () => {
    const { hasNextPage } = parseVivatPage(html);
    expect(hasNextPage).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// parseVivatPage — catalog-invalid-price.html
// ──────────────────────────────────────────────────────────────

describe('parseVivatPage — catalog-invalid-price.html', () => {
  const html = loadFixture('catalog-invalid-price.html');

  it('returns 3 listings (all paper cards included even with null price)', () => {
    const { listings } = parseVivatPage(html);
    expect(listings).toHaveLength(3);
  });

  it('zero price → price null and availability out-of-stock', () => {
    const { listings } = parseVivatPage(html);
    const prychynna = listings[0]!;
    expect(prychynna.title).toBe('Причинна');
    expect(prychynna.price).toBeNull();
    expect(prychynna.availability).toBe('out-of-stock');
  });

  it('out_of_stock statusCode → availability out-of-stock even when priced', () => {
    const { listings } = parseVivatPage(html);
    const lisova = listings[1]!;
    expect(lisova.title).toBe('Лісова пісня');
    expect(lisova.price).toEqual({ amount: 25000, currency: 'UAH' });
    expect(lisova.availability).toBe('out-of-stock');
  });

  it('negative price → price null and availability out-of-stock', () => {
    const { listings } = parseVivatPage(html);
    const marusia = listings[2]!;
    expect(marusia.title).toBe('Маруся');
    expect(marusia.price).toBeNull();
    expect(marusia.availability).toBe('out-of-stock');
  });
});

// ──────────────────────────────────────────────────────────────
// parseVivatPage — catalog-empty.html
// ──────────────────────────────────────────────────────────────

describe('parseVivatPage — catalog-empty.html', () => {
  const html = loadFixture('catalog-empty.html');

  it('returns empty listings array', () => {
    const { listings } = parseVivatPage(html);
    expect(listings).toHaveLength(0);
  });

  it('returns no errors', () => {
    const { errors } = parseVivatPage(html);
    expect(errors).toHaveLength(0);
  });

  it('hasNextPage is false when no products found', () => {
    const { hasNextPage } = parseVivatPage(html);
    expect(hasNextPage).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// parseVivatPage — malformed input
// ──────────────────────────────────────────────────────────────

describe('parseVivatPage — malformed input', () => {
  it('records an error and returns empty when __NEXT_DATA__ is missing', () => {
    const { listings, errors, hasNextPage } = parseVivatPage('<html><body></body></html>');
    expect(listings).toHaveLength(0);
    expect(errors.some((e) => e.includes('__NEXT_DATA__'))).toBe(true);
    expect(hasNextPage).toBe(false);
  });

  it('records an error when __NEXT_DATA__ JSON is invalid', () => {
    const html =
      '<script id="__NEXT_DATA__" type="application/json">{not valid json}</script>';
    const { listings, errors } = parseVivatPage(html);
    expect(listings).toHaveLength(0);
    expect(errors.some((e) => e.includes('unparseable'))).toBe(true);
  });

  it('records an error when products is not an array', () => {
    const html =
      '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{}}}</script>';
    const { listings, errors } = parseVivatPage(html);
    expect(listings).toHaveLength(0);
    expect(errors.some((e) => e.includes('products'))).toBe(true);
  });

  it('skips a product missing its code', () => {
    const html =
      '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"products":[{"title":"No code","bookType":"paper","price":{"retail":100}}]}}}</script>';
    const { listings, errors } = parseVivatPage(html);
    expect(listings).toHaveLength(0);
    expect(errors.some((e) => e.includes('missing code'))).toBe(true);
  });

  it('skips a product missing its title', () => {
    const html =
      '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"products":[{"code":"x","bookType":"paper","price":{"retail":100}}]}}}</script>';
    const { listings, errors } = parseVivatPage(html);
    expect(listings).toHaveLength(0);
    expect(errors.some((e) => e.includes('missing title'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// parseVivatPage — cover extraction (W9a F1)
// ──────────────────────────────────────────────────────────────

describe('parseVivatPage — cover extraction', () => {
  function productHtml(product: Record<string, unknown>): string {
    const payload = { props: { pageProps: { products: [product] } } };
    return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script>`;
  }

  it('resolves the site-relative image path to an absolute Vivat URL', () => {
    const { listings } = parseVivatPage(loadFixture('catalog-page.html'));
    expect(listings[0]!.coverUrl).toBe('https://vivat.com.ua/storage/a.jpg');
    expect(listings[1]!.coverUrl).toBe('https://vivat.com.ua/storage/b.png');
  });

  it('every paper listing on the standard page has a cover URL', () => {
    const { listings } = parseVivatPage(loadFixture('catalog-page.html'));
    for (const l of listings) expect(l.coverUrl).not.toBeNull();
  });

  it('passes an absolute image URL through unchanged', () => {
    const { listings } = parseVivatPage(
      productHtml({ code: 'x', title: 'T', bookType: 'paper', price: { retail: 100 }, image: 'https://cdn.example/x.jpg' }),
    );
    expect(listings[0]!.coverUrl).toBe('https://cdn.example/x.jpg');
  });

  it('returns null cover when the product has no image (missing cover never breaks the listing)', () => {
    const { listings } = parseVivatPage(
      productHtml({ code: 'x', title: 'T', bookType: 'paper', price: { retail: 100 } }),
    );
    expect(listings).toHaveLength(1);
    expect(listings[0]!.coverUrl).toBeNull();
  });

  it('returns null cover when the image value is not a string', () => {
    const { listings } = parseVivatPage(
      productHtml({ code: 'x', title: 'T', bookType: 'paper', price: { retail: 100 }, image: 123 }),
    );
    expect(listings[0]!.coverUrl).toBeNull();
  });
});
