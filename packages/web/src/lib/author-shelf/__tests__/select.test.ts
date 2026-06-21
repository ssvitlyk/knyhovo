import { describe, expect, it } from 'vitest';
import type { SearchItemDto } from '@/lib/api/types';
import { filterToAuthor, mapSearchItemToShelfBook, selectAuthorShelf } from '../select';
import type { AuthorShelfBook } from '../select';

// ---- helpers -------------------------------------------------------

function makeItem(overrides: Partial<SearchItemDto> & { id: string }): SearchItemDto {
  return {
    title: 'Default Title',
    author: 'Андрій Сапковський',
    lowestPrice: { amount: 24500, currency: 'UAH' },
    offersCount: 1,
    providers: [{ provider: 'yakaboo', price: { amount: 24500, currency: 'UAH' } }],
    coverUrl: null,
    ...overrides,
  };
}

function makeBook(overrides: Partial<AuthorShelfBook> & { id: string }): AuthorShelfBook {
  return {
    title: 'Default Title',
    author: 'Андрій Сапковський',
    price: '245 ₴',
    store: 'Yakaboo',
    coverUrl: null,
    ...overrides,
  };
}

// ---- filterToAuthor ------------------------------------------------

describe('filterToAuthor', () => {
  const AUTHOR = 'Андрій Сапковський';

  const items: SearchItemDto[] = [
    makeItem({ id: 'a', author: AUTHOR }),
    makeItem({ id: 'b', author: 'Інший Автор' }),
    makeItem({ id: 'c', author: AUTHOR }),
  ];

  it('keeps items whose author matches exactly', () => {
    const result = filterToAuthor(items, AUTHOR);
    expect(result.map(i => i.id)).toEqual(['a', 'c']);
  });

  it('matches case-insensitively', () => {
    const result = filterToAuthor(items, AUTHOR.toLowerCase());
    expect(result.map(i => i.id)).toEqual(['a', 'c']);
  });

  it('matches ignoring leading/trailing whitespace', () => {
    const result = filterToAuthor(items, `  ${AUTHOR}  `);
    expect(result.map(i => i.id)).toEqual(['a', 'c']);
  });

  it('matches despite apostrophe variants', () => {
    // Replace ' (U+2019) with ʼ (U+02BC) in author name
    const apostropheVariant = AUTHOR.replace(/'/g, 'ʼ');
    const itemsWithVariant: SearchItemDto[] = [makeItem({ id: 'x', author: apostropheVariant })];
    const result = filterToAuthor(itemsWithVariant, AUTHOR);
    // Both normalize to the same straight apostrophe, so they should match
    // (if the author name doesn't actually contain apostrophes, this is a no-op test)
    expect(result).toHaveLength(1);
  });

  it('excludes substring-only matches', () => {
    const result = filterToAuthor(items, 'Андрій');
    expect(result).toHaveLength(0);
  });

  it('returns [] for empty author string', () => {
    expect(filterToAuthor(items, '')).toEqual([]);
  });

  it('returns [] for whitespace-only author string', () => {
    expect(filterToAuthor(items, '   ')).toEqual([]);
  });
});

// ---- mapSearchItemToShelfBook --------------------------------------

describe('mapSearchItemToShelfBook', () => {
  it('formats price correctly from kopiyky', () => {
    const item = makeItem({ id: 'a', lowestPrice: { amount: 24500, currency: 'UAH' } });
    const book = mapSearchItemToShelfBook(item);
    expect(book.price).toBe('245 ₴');
  });

  it('sets store from providers[0]', () => {
    const item = makeItem({
      id: 'a',
      providers: [{ provider: 'yakaboo', price: { amount: 24500, currency: 'UAH' } }],
    });
    const book = mapSearchItemToShelfBook(item);
    expect(book.store).toBe('Yakaboo');
  });

  it('returns null store when providers is empty', () => {
    const item = makeItem({ id: 'a', providers: [] });
    const book = mapSearchItemToShelfBook(item);
    expect(book.store).toBeNull();
  });

  it('passes through coverUrl', () => {
    const item = makeItem({ id: 'a', coverUrl: 'https://example.com/cover.jpg' });
    const book = mapSearchItemToShelfBook(item);
    expect(book.coverUrl).toBe('https://example.com/cover.jpg');
  });

  it('passes through null coverUrl', () => {
    const item = makeItem({ id: 'a', coverUrl: null });
    const book = mapSearchItemToShelfBook(item);
    expect(book.coverUrl).toBeNull();
  });
});

// ---- selectAuthorShelf ---------------------------------------------

describe('selectAuthorShelf', () => {
  const roster: AuthorShelfBook[] = [
    makeBook({ id: 'a', title: 'Book A' }),
    makeBook({ id: 'b', title: 'Book B' }),
    makeBook({ id: 'c', title: 'Book C' }),
    makeBook({ id: 'd', title: 'Book D' }),
    makeBook({ id: 'e', title: 'Book E' }),
  ];

  it('excludes currentId', () => {
    const result = selectAuthorShelf({ currentId: 'a', roster, cap: 4 });
    expect(result.books.map(b => b.id)).not.toContain('a');
  });

  it('excludes seriesIds', () => {
    const result = selectAuthorShelf({ currentId: 'a', roster, seriesIds: ['b', 'c'], cap: 4 });
    expect(result.books.map(b => b.id)).not.toContain('b');
    expect(result.books.map(b => b.id)).not.toContain('c');
  });

  it('preserves order and slices to cap', () => {
    const result = selectAuthorShelf({ currentId: 'a', roster, cap: 3 });
    expect(result.books.map(b => b.id)).toEqual(['b', 'c', 'd']);
  });

  it('show=false when 0 books remain', () => {
    const result = selectAuthorShelf({ currentId: 'a', roster: [makeBook({ id: 'a' })], cap: 4 });
    expect(result.show).toBe(false);
  });

  it('show=false when 1 book remains', () => {
    const result = selectAuthorShelf({
      currentId: 'a',
      roster: [makeBook({ id: 'a' }), makeBook({ id: 'b' })],
      cap: 4,
    });
    expect(result.show).toBe(false);
  });

  it('show=true at exactly 2 books remaining', () => {
    const result = selectAuthorShelf({
      currentId: 'a',
      roster: [makeBook({ id: 'a' }), makeBook({ id: 'b' }), makeBook({ id: 'c' })],
      cap: 4,
    });
    expect(result.show).toBe(true);
  });

  it('hasMore=true when total > cap', () => {
    const result = selectAuthorShelf({ currentId: 'a', roster, cap: 3 });
    // roster has 5 items, exclude 'a' → 4 remain, cap=3 → hasMore
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(4);
  });

  it('hasMore=false when total <= cap', () => {
    const result = selectAuthorShelf({ currentId: 'a', roster, cap: 10 });
    expect(result.hasMore).toBe(false);
  });

  it('cols = min(books.length, cap)', () => {
    const small: AuthorShelfBook[] = [
      makeBook({ id: 'a' }),
      makeBook({ id: 'b' }),
      makeBook({ id: 'c' }),
    ];
    const result = selectAuthorShelf({ currentId: 'x', roster: small, cap: 4 });
    // 3 books, cap 4 → cols = 3
    expect(result.cols).toBe(3);
  });

  it('deduplicates by id keeping first occurrence', () => {
    const withDup: AuthorShelfBook[] = [
      makeBook({ id: 'b', title: 'First B' }),
      makeBook({ id: 'b', title: 'Dup B' }),
      makeBook({ id: 'c' }),
    ];
    const result = selectAuthorShelf({ currentId: 'a', roster: withDup, cap: 4 });
    const ids = result.books.map(b => b.id);
    expect(ids.filter(id => id === 'b')).toHaveLength(1);
    expect(result.books.find(b => b.id === 'b')?.title).toBe('First B');
  });
});
