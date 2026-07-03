import { describe, expect, it } from 'vitest';
import {
  searchHref,
  FEATURED,
  DYNAMIC_COLLECTIONS,
  GENRES,
  EDITORIAL,
  AUTHORS,
} from '../content';
import { formatCount } from '../format';

/** Every curated collection with a `slug` + `href` — the navigable cards. */
const SLUGGED: ReadonlyArray<readonly [string, ReadonlyArray<{ readonly slug: string; readonly href: string }>]> = [
  ['DYNAMIC_COLLECTIONS', DYNAMIC_COLLECTIONS],
  ['GENRES', GENRES],
  ['EDITORIAL', EDITORIAL],
  ['AUTHORS', AUTHORS],
];

describe('catalog content module', () => {
  it('exposes non-empty curated sections', () => {
    expect(DYNAMIC_COLLECTIONS.length).toBeGreaterThan(0);
    expect(GENRES.length).toBe(8);
    expect(EDITORIAL.length).toBe(3);
    expect(AUTHORS.length).toBe(8);
  });

  it.each(SLUGGED)('%s slugs are unique', (_name, items) => {
    const slugs = items.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(SLUGGED)('%s cards all navigate to the /search?q= seam', (_name, items) => {
    for (const i of items) {
      expect(i.href).toMatch(/^\/search\?q=.+/);
    }
  });

  it('Featured card is well-formed and links to the search seam', () => {
    expect(FEATURED.title.trim().length).toBeGreaterThan(0);
    expect(FEATURED.desc.trim().length).toBeGreaterThan(0);
    expect(FEATURED.count).toBeGreaterThan(0);
    expect(FEATURED.coverSeeds.length).toBe(3);
    expect(FEATURED.href).toMatch(/^\/search\?q=.+/);
  });

  it('genres carry an emoji, a positive count and a name', () => {
    for (const g of GENRES) {
      expect(g.name.trim().length).toBeGreaterThan(0);
      expect(g.emoji.trim().length).toBeGreaterThan(0);
      expect(g.count).toBeGreaterThan(0);
    }
  });

  it('editorial cards have either an avatar image or a glyph fallback', () => {
    for (const ed of EDITORIAL) {
      expect(Boolean(ed.avatar) || Boolean(ed.avatarLetter)).toBe(true);
    }
  });
});

describe('searchHref', () => {
  it('builds a URL-encoded /search?q= href', () => {
    expect(searchHref('Художня проза')).toBe(`/search?q=${encodeURIComponent('Художня проза')}`);
    expect(searchHref('Sapiens')).toBe('/search?q=Sapiens');
  });
});

describe('formatCount', () => {
  it('groups thousands with a non-breaking space', () => {
    expect(formatCount(1840)).toBe('1 840');
    expect(formatCount(921)).toBe('921');
    expect(formatCount(1000000)).toBe('1 000 000');
  });
});
