import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  firstNonEmptyHtml,
  firstNonEmptyText,
  makeResolveUrl,
  extractCoverUrl,
} from '../html-helpers.js';

const $ = cheerio.load('<div class="a">  </div><div class="b"> <b>hi</b> </div><p class="c"> text </p>');

describe('firstNonEmptyHtml', () => {
  it('returns the first non-blank inner HTML in selector order', () => {
    expect(firstNonEmptyHtml($, ['.a', '.b'])).toBe(' <b>hi</b> ');
  });
  it('returns null when nothing matches or all blank', () => {
    expect(firstNonEmptyHtml($, ['.a', '.zzz'])).toBeNull();
    expect(firstNonEmptyHtml($, [])).toBeNull();
  });
});

describe('firstNonEmptyText', () => {
  it('returns trimmed text of the first non-blank match', () => {
    expect(firstNonEmptyText($, ['.a', '.c'])).toBe('text');
  });
  it('returns empty string when nothing matches', () => {
    expect(firstNonEmptyText($, ['.a', '.zzz'])).toBe('');
  });
});

describe('makeResolveUrl', () => {
  const resolve = makeResolveUrl('https://shop.test');
  it('keeps absolute URLs and prefixes relative ones', () => {
    expect(resolve('https://x/y')).toBe('https://x/y');
    expect(resolve('/a')).toBe('https://shop.test/a');
    expect(resolve('a')).toBe('https://shop.test/a');
  });
});

describe('extractCoverUrl', () => {
  const resolve = makeResolveUrl('https://shop.test');
  it('normalises src values', () => {
    expect(extractCoverUrl(' //cdn/a.jpg ', resolve)).toBe('https://cdn/a.jpg');
    expect(extractCoverUrl('/a.jpg', resolve)).toBe('https://shop.test/a.jpg');
    expect(extractCoverUrl('  ', resolve)).toBeNull();
    expect(extractCoverUrl(undefined, resolve)).toBeNull();
  });
});
