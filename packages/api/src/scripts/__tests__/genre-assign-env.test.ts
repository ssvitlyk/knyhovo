import { describe, expect, it } from 'vitest';
import { isGenreAssignAfterScrapeEnabled } from '../genre-assign-env.js';

describe('isGenreAssignAfterScrapeEnabled', () => {
  it('is disabled when the env var is undefined', () => {
    expect(isGenreAssignAfterScrapeEnabled({})).toBe(false);
  });

  it('is disabled for "false"', () => {
    expect(isGenreAssignAfterScrapeEnabled({ GENRE_ASSIGN_AFTER_SCRAPE: 'false' })).toBe(false);
  });

  it('is disabled for garbage values', () => {
    expect(isGenreAssignAfterScrapeEnabled({ GENRE_ASSIGN_AFTER_SCRAPE: 'yes' })).toBe(false);
    expect(isGenreAssignAfterScrapeEnabled({ GENRE_ASSIGN_AFTER_SCRAPE: '1' })).toBe(false);
    expect(isGenreAssignAfterScrapeEnabled({ GENRE_ASSIGN_AFTER_SCRAPE: 'TRUE' })).toBe(false);
  });

  it('is enabled only for the exact string "true"', () => {
    expect(isGenreAssignAfterScrapeEnabled({ GENRE_ASSIGN_AFTER_SCRAPE: 'true' })).toBe(true);
  });
});
