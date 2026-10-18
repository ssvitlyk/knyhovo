import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  JSON_LD_SELECTOR,
  matchesType,
  findByType,
  readJsonLdBlocks,
  readString,
  readName,
  firstNonEmptyString,
  makeCoverUrlBuilder,
  resolveSchemaOrgAvailability,
} from '../json-ld.js';

function page(...blocks: string[]): cheerio.CheerioAPI {
  return cheerio.load(
    `<html><head>${blocks.map((b) => `<script type="application/ld+json">${b}</script>`).join('')}</head></html>`,
  );
}

describe('matchesType / findByType', () => {
  it('matches string and array @type', () => {
    expect(matchesType('Product', 'Product')).toBe(true);
    expect(matchesType(['Thing', 'Product'], 'Product')).toBe(true);
    expect(matchesType('Book', 'Product')).toBe(false);
    expect(matchesType(undefined, 'Product')).toBe(false);
  });

  it('finds in objects, arrays and @graph', () => {
    const product = { '@type': 'Product', name: 'x' };
    expect(findByType(product, 'Product')).toBe(product);
    expect(findByType([{ '@type': 'Book' }, product], 'Product')).toBe(product);
    expect(findByType({ '@graph': [{ '@type': 'WebSite' }, product] }, 'Product')).toBe(product);
    expect(findByType({ '@type': 'Book' }, 'Product')).toBeNull();
    expect(findByType('str', 'Product')).toBeNull();
    expect(findByType(null, 'Product')).toBeNull();
  });
});

describe('readJsonLdBlocks', () => {
  it('reports a page without JSON-LD', () => {
    const r = readJsonLdBlocks(cheerio.load('<html></html>'), ['Product']);
    expect(r.found['Product']).toBeNull();
    expect(r.errors).toEqual(['no JSON-LD script found']);
  });

  it('collects the first match per type across blocks, recording malformed JSON', () => {
    const $ = page('{bad', '{"@type":"Product","name":"p1"}', '{"@type":"Book","name":"b"}', '{"@type":"Product","name":"p2"}', '{worse');
    const r = readJsonLdBlocks($, ['Product', 'Book']);
    expect(r.found['Product']).toMatchObject({ name: 'p1' });
    expect(r.found['Book']).toMatchObject({ name: 'b' });
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatch(/^malformed JSON-LD — /);
  });

  it('skips blank blocks', () => {
    const r = readJsonLdBlocks(page('   ', '{"@type":"Product"}'), ['Product']);
    expect(r.found['Product']).not.toBeNull();
    expect(r.errors).toEqual([]);
  });

  it('stopWhenFound returns before later malformed blocks', () => {
    const $ = page('{bad', '{"@type":"Product"}', '{worse');
    const all = readJsonLdBlocks($, ['Product']);
    const stopped = readJsonLdBlocks($, ['Product'], { stopWhenFound: true });
    expect(all.errors).toHaveLength(2);
    expect(stopped.errors).toHaveLength(1);
    expect(stopped.found['Product']).not.toBeNull();
  });

  it('exposes the selector', () => {
    expect(JSON_LD_SELECTOR).toBe('script[type="application/ld+json"]');
  });
});

describe('string readers', () => {
  it('readString trims and rejects blanks/non-strings', () => {
    expect(readString('  a ')).toBe('a');
    expect(readString('  ')).toBeNull();
    expect(readString(1)).toBeNull();
  });

  it('readName reads strings and {name} objects', () => {
    expect(readName(' A ')).toBe('A');
    expect(readName({ name: ' B ' })).toBe('B');
    expect(readName({ name: '' })).toBeNull();
    expect(readName({})).toBeNull();
    expect(readName(null)).toBeNull();
    expect(readName('')).toBeNull();
  });

  it('firstNonEmptyString handles strings and arrays', () => {
    expect(firstNonEmptyString(' a ')).toBe('a');
    expect(firstNonEmptyString(['', 5, ' b '])).toBe('b');
    expect(firstNonEmptyString([])).toBeNull();
    expect(firstNonEmptyString(' ')).toBeNull();
    expect(firstNonEmptyString(3)).toBeNull();
  });
});

describe('makeCoverUrlBuilder', () => {
  const build = makeCoverUrlBuilder('https://shop.test');
  it('resolves absolute, protocol-relative, rooted and bare paths', () => {
    expect(build('https://cdn/a.jpg')).toBe('https://cdn/a.jpg');
    expect(build('//cdn/a.jpg')).toBe('https://cdn/a.jpg');
    expect(build('/a.jpg')).toBe('https://shop.test/a.jpg');
    expect(build('a.jpg')).toBe('https://shop.test/a.jpg');
    expect(build(['', '/a.jpg'])).toBe('https://shop.test/a.jpg');
    expect(build(null)).toBeNull();
  });
});

describe('resolveSchemaOrgAvailability', () => {
  it('maps suffixes', () => {
    expect(resolveSchemaOrgAvailability('https://schema.org/InStock', true)).toBe('in-stock');
    expect(resolveSchemaOrgAvailability('http://schema.org/PreOrder', true)).toBe('in-stock');
    expect(resolveSchemaOrgAvailability('https://schema.org/OutOfStock', true)).toBe('out-of-stock');
    expect(resolveSchemaOrgAvailability('https://schema.org/SoldOut', true)).toBe('out-of-stock');
    expect(resolveSchemaOrgAvailability('https://schema.org/Whatever', true)).toBe('unknown');
    expect(resolveSchemaOrgAvailability(undefined, true)).toBe('unknown');
  });

  it('missing price wins', () => {
    expect(resolveSchemaOrgAvailability('https://schema.org/InStock', false)).toBe('out-of-stock');
  });

  it('discontinued is out-of-stock unless disabled', () => {
    const d = 'https://schema.org/Discontinued';
    expect(resolveSchemaOrgAvailability(d, true)).toBe('out-of-stock');
    expect(resolveSchemaOrgAvailability(d, true, { discontinued: false })).toBe('unknown');
  });
});
