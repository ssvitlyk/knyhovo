import { describe, it, expect } from 'vitest';
import { DEFAULT_MIN_GENRE_BOOK_COUNT, parseMinGenreBookCountFromEnv } from '../genre-threshold-env.js';

describe('parseMinGenreBookCountFromEnv', () => {
  it('defaults to 30 when the env var is absent', () => {
    expect(parseMinGenreBookCountFromEnv({})).toBe(DEFAULT_MIN_GENRE_BOOK_COUNT);
    expect(DEFAULT_MIN_GENRE_BOOK_COUNT).toBe(30);
  });

  it('uses the override when it is a valid non-negative integer', () => {
    expect(parseMinGenreBookCountFromEnv({ COLLECTIONS_MIN_GENRE_BOOK_COUNT: '5' })).toBe(5);
    expect(parseMinGenreBookCountFromEnv({ COLLECTIONS_MIN_GENRE_BOOK_COUNT: '0' })).toBe(0);
    expect(parseMinGenreBookCountFromEnv({ COLLECTIONS_MIN_GENRE_BOOK_COUNT: '100' })).toBe(100);
  });

  it('falls back to the default for a negative value', () => {
    expect(parseMinGenreBookCountFromEnv({ COLLECTIONS_MIN_GENRE_BOOK_COUNT: '-5' })).toBe(DEFAULT_MIN_GENRE_BOOK_COUNT);
  });

  it('falls back to the default for a non-integer value', () => {
    expect(parseMinGenreBookCountFromEnv({ COLLECTIONS_MIN_GENRE_BOOK_COUNT: '5.5' })).toBe(DEFAULT_MIN_GENRE_BOOK_COUNT);
  });

  it('falls back to the default for garbage input', () => {
    expect(parseMinGenreBookCountFromEnv({ COLLECTIONS_MIN_GENRE_BOOK_COUNT: 'not-a-number' })).toBe(
      DEFAULT_MIN_GENRE_BOOK_COUNT,
    );
    expect(parseMinGenreBookCountFromEnv({ COLLECTIONS_MIN_GENRE_BOOK_COUNT: '' })).toBe(DEFAULT_MIN_GENRE_BOOK_COUNT);
  });
});
