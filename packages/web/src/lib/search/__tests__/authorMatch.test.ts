import { describe, expect, it } from 'vitest';
import type { SearchItemDto } from '@/lib/api/types';
import { findAuthorMatch } from '../authorMatch';

function makeItem(id: string, author: string, title = 'Книга'): SearchItemDto {
  return {
    id,
    title,
    author,
    lowestPrice: { amount: 29900, currency: 'UAH' },
    offersCount: 1,
    providers: [],
    coverUrl: null,
  };
}

describe('findAuthorMatch', () => {
  it('returns the full author when the query is a surname only', () => {
    const items = [makeItem('1', 'Макс Кідрук')];
    expect(findAuthorMatch('Кідрук', items)).toBe('Макс Кідрук');
  });

  it('returns null when the query already equals the only author (self-referential jump)', () => {
    const items = [makeItem('1', 'Макс Кідрук')];
    expect(findAuthorMatch('Макс Кідрук', items)).toBeNull();
  });

  it('returns the author for a full-name query in reversed token order (still not string-equal to normalized author)', () => {
    // 'кідрук макс' !== 'макс кідрук' as strings, so the self-referential guard does not
    // trigger even though it is semantically the same author — this is the accepted behavior.
    const items = [makeItem('1', 'Макс Кідрук')];
    expect(findAuthorMatch('Кідрук Макс', items)).toBe('Макс Кідрук');
  });

  it('extracts individual authors from a comma-separated anthology author string', () => {
    const items = [
      makeItem('1', "Іван Франко, Макс Кідрук, Павло Дерев'янко"),
      makeItem('2', 'Макс Кідрук'),
    ];
    expect(findAuthorMatch('Кідрук', items)).toBe('Макс Кідрук');
  });

  it('returns null when the surname query is ambiguous across distinct authors', () => {
    const items = [makeItem('1', 'Макс Кідрук'), makeItem('2', 'Іван Кідрук')];
    expect(findAuthorMatch('Кідрук', items)).toBeNull();
  });

  it('returns null when the query matches a title but not any author token', () => {
    const items = [makeItem('1', 'Автор Один', 'Заголовок Книги')];
    expect(findAuthorMatch('Заголовок Книги', items)).toBeNull();
  });

  it('returns null for empty items array', () => {
    expect(findAuthorMatch('Сергій Жадан', [])).toBeNull();
  });

  it('returns null for an empty query', () => {
    const items = [makeItem('1', 'Сергій Жадан')];
    expect(findAuthorMatch('', items)).toBeNull();
  });

  it('returns null for a whitespace-only query', () => {
    const items = [makeItem('1', 'Сергій Жадан')];
    expect(findAuthorMatch('   ', items)).toBeNull();
  });

  it('matches case-insensitively via normalizeQuery', () => {
    const items = [makeItem('1', 'Сергій Жадан')];
    expect(findAuthorMatch('ЖАДАН', items)).toBe('Сергій Жадан');
  });

  it('returns the original-cased display form from the first-seen occurrence', () => {
    const items = [makeItem('1', 'СЕРГІЙ ЖАДАН'), makeItem('2', 'сергій жадан')];
    expect(findAuthorMatch('ЖАДАН', items)).toBe('СЕРГІЙ ЖАДАН');
  });
});
