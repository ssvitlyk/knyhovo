import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseVivatProduct } from '../vivat.parser.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('parseVivatProduct', () => {
  it('extracts price and in-stock availability from a product page', () => {
    const result = parseVivatProduct(loadFixture('product-page.html'));
    // promotion price = 299 → 29900 kopecks
    expect(result.price).toEqual({ amount: 29900, currency: 'UAH' });
    expect(result.availability).toBe('in-stock');
  });

  it('returns out-of-stock with null price when product has no price', () => {
    const result = parseVivatProduct(loadFixture('product-out-of-stock.html'));
    expect(result.price).toBeNull();
    expect(result.availability).toBe('out-of-stock');
  });

  it('returns unknown when __NEXT_DATA__ is missing', () => {
    const result = parseVivatProduct('<html><body>no script</body></html>');
    expect(result.price).toBeNull();
    expect(result.availability).toBe('unknown');
  });

  it('returns unknown for empty HTML', () => {
    const result = parseVivatProduct('');
    expect(result.price).toBeNull();
    expect(result.availability).toBe('unknown');
  });

  it('uses retail price when promotion is absent', () => {
    const html = `<html><body><script id="__NEXT_DATA__" type="application/json">
{"props":{"pageProps":{"product":{"code":"test","statusCode":"active","price":{"retail":450}}}}}
</script></body></html>`;
    const result = parseVivatProduct(html);
    expect(result.price).toEqual({ amount: 45000, currency: 'UAH' });
    expect(result.availability).toBe('in-stock');
  });
});
