import { describe, expect, it, beforeEach } from 'vitest';
import {
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_LIMIT,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '../recentSearches';

describe('recentSearches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getRecentSearches', () => {
    it('returns an empty array when localStorage is empty', () => {
      expect(getRecentSearches()).toEqual([]);
    });

    it('returns stored searches', () => {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['книга', 'автор']));
      expect(getRecentSearches()).toEqual(['книга', 'автор']);
    });

    it('returns empty array when stored value is not an array', () => {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify({ key: 'value' }));
      expect(getRecentSearches()).toEqual([]);
    });

    it('filters out non-string elements', () => {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['книга', 42, null, 'автор']));
      expect(getRecentSearches()).toEqual(['книга', 'автор']);
    });

    it('returns empty array on malformed JSON', () => {
      localStorage.setItem(RECENT_SEARCHES_KEY, 'not-valid-json{');
      expect(getRecentSearches()).toEqual([]);
    });
  });

  describe('addRecentSearch', () => {
    it('adds a query and returns it as the first element', () => {
      const result = addRecentSearch('Гаррі Поттер');
      expect(result[0]).toBe('Гаррі Поттер');
    });

    it('persists the added query', () => {
      addRecentSearch('Гаррі Поттер');
      expect(getRecentSearches()[0]).toBe('Гаррі Поттер');
    });

    it('most recent query appears first', () => {
      addRecentSearch('перша');
      addRecentSearch('друга');
      expect(getRecentSearches()).toEqual(['друга', 'перша']);
    });

    it('deduplicates case-insensitively (same entry, different case)', () => {
      addRecentSearch('Гаррі Поттер');
      addRecentSearch('гаррі поттер');
      expect(getRecentSearches()).toEqual(['гаррі поттер']);
    });

    it('deduplication moves existing entry to top', () => {
      addRecentSearch('перша');
      addRecentSearch('друга');
      addRecentSearch('перша');
      expect(getRecentSearches()).toEqual(['перша', 'друга']);
    });

    it('ignores empty strings', () => {
      addRecentSearch('щось');
      const result = addRecentSearch('');
      expect(result).toEqual(['щось']);
    });

    it('ignores whitespace-only strings', () => {
      addRecentSearch('щось');
      const result = addRecentSearch('   ');
      expect(result).toEqual(['щось']);
    });

    it('caps the list at RECENT_SEARCHES_LIMIT', () => {
      for (let i = 0; i < RECENT_SEARCHES_LIMIT + 3; i++) {
        addRecentSearch(`запит ${i}`);
      }
      expect(getRecentSearches()).toHaveLength(RECENT_SEARCHES_LIMIT);
    });

    it('most recent is still first after capping', () => {
      for (let i = 0; i < RECENT_SEARCHES_LIMIT + 3; i++) {
        addRecentSearch(`запит ${i}`);
      }
      expect(getRecentSearches()[0]).toBe(`запит ${RECENT_SEARCHES_LIMIT + 2}`);
    });

    it('stores the trimmed original-cased query', () => {
      addRecentSearch('  Гаррі Поттер  ');
      expect(getRecentSearches()[0]).toBe('Гаррі Поттер');
    });
  });

  describe('removeRecentSearch', () => {
    it('removes the matching entry', () => {
      addRecentSearch('Гаррі Поттер');
      addRecentSearch('Кобзар');
      removeRecentSearch('Гаррі Поттер');
      expect(getRecentSearches()).toEqual(['Кобзар']);
    });

    it('removes case-insensitively', () => {
      addRecentSearch('Гаррі Поттер');
      removeRecentSearch('гаррі поттер');
      expect(getRecentSearches()).toEqual([]);
    });

    it('is a no-op for a non-existing entry', () => {
      addRecentSearch('Кобзар');
      removeRecentSearch('Невідомо');
      expect(getRecentSearches()).toEqual(['Кобзар']);
    });

    it('returns the updated list', () => {
      addRecentSearch('перша');
      addRecentSearch('друга');
      const result = removeRecentSearch('перша');
      expect(result).toEqual(['друга']);
    });
  });

  describe('clearRecentSearches', () => {
    it('removes all entries', () => {
      addRecentSearch('перша');
      addRecentSearch('друга');
      clearRecentSearches();
      expect(getRecentSearches()).toEqual([]);
    });

    it('removes the localStorage key entirely', () => {
      addRecentSearch('щось');
      clearRecentSearches();
      expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
    });

    it('is a no-op when the list is already empty', () => {
      expect(() => clearRecentSearches()).not.toThrow();
      expect(getRecentSearches()).toEqual([]);
    });
  });

  describe('SSR safety (window check)', () => {
    it('getRecentSearches is defined and returns an array type in jsdom', () => {
      // jsdom provides window, so this verifies the happy path.
      expect(Array.isArray(getRecentSearches())).toBe(true);
    });
  });
});
