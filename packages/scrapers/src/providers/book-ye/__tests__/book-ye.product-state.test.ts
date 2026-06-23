import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseBookYeProduct } from '../book-ye.parser.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('parseBookYeProduct', () => {
  it('extracts price and in-stock availability from a product page', () => {
    const result = parseBookYeProduct(loadFixture('product-page.html'));
    expect(result.price).toEqual({ amount: 28500, currency: 'UAH' });
    expect(result.availability).toBe('in-stock');
  });

  it('returns out-of-stock with null price when no price element present', () => {
    const result = parseBookYeProduct(loadFixture('product-out-of-stock.html'));
    expect(result.price).toBeNull();
    expect(result.availability).toBe('out-of-stock');
  });

  it('returns unknown for empty HTML', () => {
    const result = parseBookYeProduct('');
    expect(result.price).toBeNull();
    expect(result.availability).toBe('unknown');
  });

  it('extracts price from data-price-amount attribute', () => {
    const html = `<html><body>
      <span data-price-type="finalPrice" data-price-amount="350"></span>
    </body></html>`;
    const result = parseBookYeProduct(html);
    expect(result.price).toEqual({ amount: 35000, currency: 'UAH' });
    expect(result.availability).toBe('in-stock');
  });
});
