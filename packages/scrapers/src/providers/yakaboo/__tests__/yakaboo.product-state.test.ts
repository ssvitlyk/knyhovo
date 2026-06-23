import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseYakabooProduct } from '../yakaboo.parser.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('parseYakabooProduct', () => {
  it('extracts price and in-stock availability from a product page', () => {
    const result = parseYakabooProduct(loadFixture('product-page.html'));
    expect(result.price).toEqual({ amount: 34900, currency: 'UAH' });
    expect(result.availability).toBe('in-stock');
  });

  it('returns out-of-stock with null price when no price element present', () => {
    const result = parseYakabooProduct(loadFixture('product-out-of-stock.html'));
    expect(result.price).toBeNull();
    expect(result.availability).toBe('out-of-stock');
  });

  it('returns out-of-stock when status text contains out-of-stock keyword', () => {
    const result = parseYakabooProduct(loadFixture('product-out-of-stock.html'));
    expect(result.availability).toBe('out-of-stock');
  });

  it('returns unknown availability for empty HTML', () => {
    // No price, no status → out-of-stock (no price rule)
    const result = parseYakabooProduct('');
    expect(result.price).toBeNull();
    expect(result.availability).toBe('out-of-stock');
  });

  it('returns in-stock with price when page has price but no explicit status', () => {
    const html = `<html><body><div class="product-price">500 грн</div></body></html>`;
    const result = parseYakabooProduct(html);
    expect(result.price).toEqual({ amount: 50000, currency: 'UAH' });
    // No status text → resolveAvailability('', true) → 'in-stock' (empty string → in-stock)
    expect(result.availability).toBe('in-stock');
  });
});
