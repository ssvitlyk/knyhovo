import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { syncGenres } from '../sync.js';

/**
 * `syncGenres` must refuse a structurally invalid `mappings.seed.ts` BEFORE
 * touching the database. The seed module is mocked per-file (vi.mock is
 * hoisted), so this lives apart from the main sync tests.
 */
vi.mock('../mappings.seed.js', () => ({
  GENRE_MAPPINGS_SEED: [
    {
      provider: 'bookchef',
      sourceCategory: 'фентезі',
      genreSlug: 'no-such-genre',
      confidence: 95,
      notes: 'points at a slug missing from CANONICAL_GENRES',
    },
  ],
}));

describe('syncGenres — seed validation', () => {
  it('throws on an unknown genre slug before any DB access', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = { collection: { findMany } } as unknown as PrismaClient;

    await expect(syncGenres(prisma)).rejects.toThrow(/unknown genre slug "no-such-genre"/);
    expect(findMany).not.toHaveBeenCalled();
  });
});
