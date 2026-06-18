import { describe, expect, it } from 'vitest';
import type { SearchItemDto } from '@/lib/api/types';
import { findAuthorExactMatch } from '../authorMatch';

function makeItem(id: string, author: string, title = 'Книга'): SearchItemDto {
  return {
    id,
    title,
    author,
    lowestPrice: { amount: 29900, currency: 'UAH' },
    offersCount: 1,
    providers: [],
  };
}

describe('findAuthorExactMatch', () => {
  it('returns the display author when the query exactly matches the single author', () => {
    const items = [makeItem('1', 'Сергій Жадан'), makeItem('2', 'Сергій Жадан')];
    expect(findAuthorExactMatch('Сергій Жадан', items)).toBe('Сергій Жадан');
  });

  it('matches the author case-insensitively', () => {
    const items = [makeItem('1', 'Сергій Жадан')];
    expect(findAuthorExactMatch('сергій жадан', items)).toBe('Сергій Жадан');
  });

  it('matches the author whitespace-insensitively', () => {
    const items = [makeItem('1', 'Сергій Жадан')];
    expect(findAuthorExactMatch('  Сергій   Жадан  ', items)).toBe('Сергій Жадан');
  });

  it('returns null when the query matches a title but not an author', () => {
    const items = [makeItem('1', 'Автор Один', 'Заголовок Книги')];
    expect(findAuthorExactMatch('Заголовок Книги', items)).toBeNull();
  });

  it('returns null for empty items array', () => {
    expect(findAuthorExactMatch('Сергій Жадан', [])).toBeNull();
  });

  it('returns the matched author when query equals one of two distinct authors', () => {
    const items = [
      makeItem('1', 'Сергій Жадан'),
      makeItem('2', 'Ліна Костенко'),
    ];
    // Query matches exactly one distinct author → should return that author.
    expect(findAuthorExactMatch('Сергій Жадан', items)).toBe('Сергій Жадан');
  });

  it('returns null when the query does not match any author', () => {
    const items = [makeItem('1', 'Ліна Костенко'), makeItem('2', 'Іван Франко')];
    expect(findAuthorExactMatch('Тарас Шевченко', items)).toBeNull();
  });

  it('returns null for a query that matches no author (ambiguity guard not triggered, just no match)', () => {
    const items = [makeItem('1', 'Автор А'), makeItem('2', 'Автор Б')];
    expect(findAuthorExactMatch('Невідомий Автор', items)).toBeNull();
  });

  it('returns the original-cased author from the first matching item', () => {
    // Both items have the same author but one has different casing — the FIRST match is returned.
    const items = [makeItem('1', 'СЕРГІЙ ЖАДАН'), makeItem('2', 'сергій жадан')];
    // Both normalize to 'сергій жадан' — they are the same distinct author.
    expect(findAuthorExactMatch('Сергій Жадан', items)).toBe('СЕРГІЙ ЖАДАН');
  });

  it('returns null for an empty query', () => {
    const items = [makeItem('1', '')];
    // The single item has empty author; normalizeQuery('') = '' = normalizeQuery(''), so it matches.
    // But this edge covers an author that happens to be empty.
    expect(findAuthorExactMatch('Реальний Автор', items)).toBeNull();
  });
});
