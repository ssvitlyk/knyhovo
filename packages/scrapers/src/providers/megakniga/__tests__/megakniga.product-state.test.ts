import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseMegaknigaProduct } from '../megakniga.parser.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('parseMegaknigaProduct', () => {
  it('parses price + in-stock availability from the InStock microdata', () => {
    const { price, availability } = parseMegaknigaProduct(loadFixture('product-in-stock.html'));
    expect(price).toEqual({ amount: 20840, currency: 'UAH' });
    expect(availability).toBe('in-stock');
  });

  it('parses price + out-of-stock availability from the OutOfStock microdata', () => {
    const { price, availability } = parseMegaknigaProduct(loadFixture('product-out-of-stock.html'));
    expect(price).toEqual({ amount: 43210, currency: 'UAH' });
    expect(availability).toBe('out-of-stock');
  });

  it('is not gated by the "Паперова книга" marker (still reads microdata on a non-book page)', () => {
    const { price, availability } = parseMegaknigaProduct(loadFixture('product-non-book.html'));
    expect(price).toEqual({ amount: 20840, currency: 'UAH' });
    expect(availability).toBe('in-stock');
  });

  it('an explicit zero/invalid microdata price → { price: null, availability: "out-of-stock" }', () => {
    const html =
      '<meta itemprop="price" content="0"><link itemprop="availability" href="http://schema.org/InStock">';
    expect(parseMegaknigaProduct(html)).toEqual({ price: null, availability: 'out-of-stock' });
  });

  it('missing price microdata entirely → { price: null, availability: "unknown" } (non-throwing)', () => {
    expect(parseMegaknigaProduct('<html><body></body></html>')).toEqual({
      price: null,
      availability: 'unknown',
    });
  });

  it('never throws on garbage HTML', () => {
    expect(() => parseMegaknigaProduct('')).not.toThrow();
    expect(() => parseMegaknigaProduct('<<<not html>>>')).not.toThrow();
  });
});
