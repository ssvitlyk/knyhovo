import { describe, expect, it } from 'vitest';
import { GENRE_MAPPINGS_SEED } from '../mappings.seed.js';
import { CANONICAL_GENRES } from '../taxonomy.js';
import { normalizeCategoryKey } from '../normalize.js';
import { buildEngineContext, mapBookGenre } from '../mapping-engine.js';

/**
 * Structural invariants of the curated seed (genres-taxonomy PRD §8.1, G3).
 * These guard the DB contract of `genre_mappings` (normalized keys, valid
 * targets) rather than any specific curation choice.
 */
describe('GENRE_MAPPINGS_SEED — invariants', () => {
  const knownSlugs = new Set(CANONICAL_GENRES.map((g) => g.slug));

  it('every genreSlug points at a canonical genre (or is an explicit ignore)', () => {
    for (const entry of GENRE_MAPPINGS_SEED) {
      if (entry.genreSlug !== null) {
        expect(knownSlugs, `${entry.provider} "${entry.sourceCategory}"`).toContain(
          entry.genreSlug,
        );
      }
    }
  });

  it('every sourceCategory is already normalized', () => {
    for (const entry of GENRE_MAPPINGS_SEED) {
      expect(normalizeCategoryKey(entry.sourceCategory)).toBe(entry.sourceCategory);
    }
  });

  it('every confidence is an integer within 0–100', () => {
    for (const entry of GENRE_MAPPINGS_SEED) {
      expect(Number.isInteger(entry.confidence)).toBe(true);
      expect(entry.confidence).toBeGreaterThanOrEqual(0);
      expect(entry.confidence).toBeLessThanOrEqual(100);
    }
  });

  it('(provider, sourceCategory) pairs are unique', () => {
    const keys = GENRE_MAPPINGS_SEED.map((e) => `${e.provider} ${e.sourceCategory}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry documents its evidence in notes', () => {
    for (const entry of GENRE_MAPPINGS_SEED) {
      expect(entry.notes.trim().length).toBeGreaterThan(0);
    }
  });

  it('broad «художня література» roots stay at low confidence (PRD §6.2: 40–60)', () => {
    const roots = GENRE_MAPPINGS_SEED.filter((e) => e.sourceCategory === 'художня література');
    expect(roots.length).toBeGreaterThan(0);
    for (const entry of roots) {
      expect(entry.genreSlug).toBe('khudozhnia-proza');
      expect(entry.confidence).toBeGreaterThanOrEqual(40);
      expect(entry.confidence).toBeLessThanOrEqual(60);
    }
  });
});

/**
 * End-to-end sanity: the curated seed + real taxonomy resolve the exact
 * signals captured by the G2 parser fixtures.
 */
describe('GENRE_MAPPINGS_SEED — resolves the G2 fixture signals', () => {
  const genres = CANONICAL_GENRES.map((g) => ({ id: `id-${g.slug}`, slug: g.slug }));
  const genreIdBySlug = new Map(genres.map((g) => [g.slug, g.id]));
  const ctx = buildEngineContext({
    mappingRules: GENRE_MAPPINGS_SEED.map((entry) => ({
      provider: entry.provider,
      sourceCategory: entry.sourceCategory,
      genreId: entry.genreSlug === null ? null : genreIdBySlug.get(entry.genreSlug)!,
      confidence: entry.confidence,
    })),
    genres,
  });

  const cases: readonly {
    readonly name: string;
    readonly provider: 'book-club' | 'bookchef' | 'laboratory' | 'knigoland';
    readonly rawCategories: readonly string[];
    readonly expectedSlug: string | null;
  }[] = [
    {
      name: 'BookChef «Художня Література → Фентезі» (fixture)',
      provider: 'bookchef',
      rawCategories: ['Художня Література', 'Фентезі'],
      expectedSlug: 'fentezi',
    },
    {
      name: 'BookChef «Художня Література → Романи → Історичний роман» (fixture)',
      provider: 'bookchef',
      rawCategories: ['Художня Література', 'Романи', 'Історичний роман'],
      expectedSlug: 'khudozhnia-proza',
    },
    {
      name: 'BookChef «Дитяча Література → Художня Література → Дитячі пригоди» (fixture)',
      provider: 'bookchef',
      rawCategories: ['Дитяча Література', 'Художня Література', 'Дитячі пригоди'],
      expectedSlug: 'dytiachi',
    },
    {
      name: 'KSD categories «Художня література», «Фентезі» (fixture)',
      provider: 'book-club',
      rawCategories: ['Художня література', 'Фентезі'],
      expectedSlug: 'fentezi',
    },
    {
      name: 'Laboratory Book.genre "детектив" (fixture)',
      provider: 'laboratory',
      rawCategories: ['детектив'],
      expectedSlug: 'detektyvy',
    },
    {
      name: 'Knigoland «Книги → Художня література → Класична проза» (fixture)',
      provider: 'knigoland',
      rawCategories: ['Книги', 'Художня література', 'Класична проза'],
      expectedSlug: 'klasyka',
    },
    {
      name: 'Laboratory microdata root «Каталог книжок → Нон-фікшн» — leaf stays unmapped',
      provider: 'laboratory',
      rawCategories: ['Каталог книжок', 'Нон-фікшн'],
      expectedSlug: null,
    },
  ];

  it.each(cases)('$name', ({ provider, rawCategories, expectedSlug }) => {
    const result = mapBookGenre([{ provider, rawCategories, url: null }], ctx);
    if (expectedSlug === null) {
      expect(result.genreId).toBeNull();
    } else {
      expect(result.genreId).toBe(`id-${expectedSlug}`);
    }
  });

  it('junk roots are ignored, not reported as unmapped', () => {
    const result = mapBookGenre(
      [{ provider: 'knigoland', rawCategories: ['Книги', 'Художня література'], url: null }],
      ctx,
    );
    expect(result.genreId).toBe('id-khudozhnia-proza');
    expect(result.unmapped).toEqual([]);
  });

  it('«Військова справа» (no canonical genre in the 17) stays observable as unmapped', () => {
    const result = mapBookGenre(
      [{ provider: 'laboratory', rawCategories: ['Військова справа'], url: null }],
      ctx,
    );
    expect(result.genreId).toBeNull();
    expect(result.unmapped.map((u) => u.normalizedKey)).toEqual(['військова справа']);
  });
});
