import { describe, expect, it, vi } from 'vitest';
import { GenreSource, type PrismaClient } from '@prisma/client';
import {
  SEED_OVERWRITE_MIN_CONFIDENCE,
  applyGenreAssignment,
  decideGenreAssignment,
  loadEngineContext,
  type CurrentGenreAssignment,
} from '../assignment.js';
import type { GenreMappingResult } from '../mapping-engine.js';

const NOW = new Date('2026-07-12T00:00:00.000Z');

function result(genreId: string | null, confidence: number | null): GenreMappingResult {
  if (genreId === null) {
    return { genreId: null, confidence: null, explanation: null, candidates: [], unmapped: [] };
  }
  return {
    genreId,
    confidence,
    explanation: `KSD category "Фентезі"`,
    candidates: [
      {
        genreId,
        slug: 'fentezi',
        score: confidence ?? 0,
        providers: ['book-club'],
        explanation: 'KSD category "Фентезі"',
      },
    ],
    unmapped: [],
  };
}

function current(overrides: Partial<CurrentGenreAssignment> = {}): CurrentGenreAssignment {
  return { genreId: null, genreSource: null, genreConfidence: null, ...overrides };
}

describe('decideGenreAssignment — MANUAL absolute lock (§4.5)', () => {
  const manual = current({ genreId: 'g-old', genreSource: GenreSource.MANUAL });

  it('never overwrites MANUAL, even with a perfect result', () => {
    const decision = decideGenreAssignment(manual, result('g-new', 100), { now: NOW });
    expect(decision.action).toBe('manual-locked');
    expect(decision.write).toBeNull();
  });

  it('never clears MANUAL, even with clearStale and no result', () => {
    const decision = decideGenreAssignment(manual, result(null, null), {
      clearStale: true,
      now: NOW,
    });
    expect(decision.action).toBe('manual-locked');
    expect(decision.write).toBeNull();
  });

  it('locks MANUAL even when its genreId is null', () => {
    const decision = decideGenreAssignment(
      current({ genreSource: GenreSource.MANUAL }),
      result('g-new', 100),
      { now: NOW },
    );
    expect(decision.action).toBe('manual-locked');
    expect(decision.write).toBeNull();
  });
});

describe('decideGenreAssignment — unassigned books (§4.4)', () => {
  it('assigns on any result, however low the confidence', () => {
    const decision = decideGenreAssignment(current(), result('g-new', 40), { now: NOW });
    expect(decision.action).toBe('assign');
    expect(decision.write).toEqual({
      genreId: 'g-new',
      genreSource: GenreSource.PROVIDER_MAPPING,
      genreConfidence: 40,
      genreUpdatedAt: NOW,
    });
  });

  it('keeps (no-op) when there is no result either', () => {
    const decision = decideGenreAssignment(current(), result(null, null), { now: NOW });
    expect(decision.action).toBe('keep');
    expect(decision.write).toBeNull();
  });
});

describe('decideGenreAssignment — PROVIDER_MAPPING re-mapping (§4.4)', () => {
  const assigned = current({
    genreId: 'g-old',
    genreSource: GenreSource.PROVIDER_MAPPING,
    genreConfidence: 80,
  });

  it('overwrites when the new genre differs', () => {
    const decision = decideGenreAssignment(assigned, result('g-new', 60), { now: NOW });
    expect(decision.action).toBe('assign');
    expect(decision.write?.genreId).toBe('g-new');
    expect(decision.write?.genreConfidence).toBe(60);
  });

  it('overwrites when the genre is unchanged but confidence differs', () => {
    const decision = decideGenreAssignment(assigned, result('g-old', 95), { now: NOW });
    expect(decision.action).toBe('assign');
    expect(decision.write?.genreConfidence).toBe(95);
  });

  it('is an idempotent no-op when the result matches exactly', () => {
    const decision = decideGenreAssignment(assigned, result('g-old', 80), { now: NOW });
    expect(decision.action).toBe('keep');
    expect(decision.write).toBeNull();
  });

  it('keeps the assignment on a vanished signal by default (graceful)', () => {
    const decision = decideGenreAssignment(assigned, result(null, null), { now: NOW });
    expect(decision.action).toBe('keep');
    expect(decision.write).toBeNull();
  });

  it('clears on a vanished signal only with clearStale — writes all-null (§8.2 parity)', () => {
    const decision = decideGenreAssignment(assigned, result(null, null), {
      clearStale: true,
      now: NOW,
    });
    expect(decision.action).toBe('clear-stale');
    expect(decision.write).toEqual({
      genreId: null,
      genreSource: null,
      genreConfidence: null,
      genreUpdatedAt: null,
    });
  });
});

describe('decideGenreAssignment — SEED / legacy assignments (§4.4)', () => {
  const seeded = current({ genreId: 'g-seeded', genreSource: GenreSource.SEED });
  const legacy = current({ genreId: 'g-legacy', genreSource: null });

  it(`overwrites SEED at confidence ≥ ${SEED_OVERWRITE_MIN_CONFIDENCE}`, () => {
    const decision = decideGenreAssignment(seeded, result('g-new', 70), { now: NOW });
    expect(decision.action).toBe('assign');
    expect(decision.write?.genreSource).toBe(GenreSource.PROVIDER_MAPPING);
  });

  it('keeps SEED below the threshold', () => {
    const decision = decideGenreAssignment(seeded, result('g-new', 69), { now: NOW });
    expect(decision.action).toBe('keep');
    expect(decision.write).toBeNull();
  });

  it('treats a legacy null-source assignment like SEED', () => {
    expect(decideGenreAssignment(legacy, result('g-new', 69), { now: NOW }).action).toBe('keep');
    expect(decideGenreAssignment(legacy, result('g-new', 70), { now: NOW }).action).toBe('assign');
  });

  it('takes ownership even when the genre is unchanged (source becomes PROVIDER_MAPPING)', () => {
    const decision = decideGenreAssignment(seeded, result('g-seeded', 90), { now: NOW });
    expect(decision.action).toBe('assign');
    expect(decision.write).toEqual({
      genreId: 'g-seeded',
      genreSource: GenreSource.PROVIDER_MAPPING,
      genreConfidence: 90,
      genreUpdatedAt: NOW,
    });
  });

  it('never clears SEED via clearStale — clear-stale is PROVIDER_MAPPING-only', () => {
    const decision = decideGenreAssignment(seeded, result(null, null), {
      clearStale: true,
      now: NOW,
    });
    expect(decision.action).toBe('keep');
    expect(decision.write).toBeNull();
  });
});

describe('decideGenreAssignment — explainability', () => {
  it('every decision carries a human-readable reason', () => {
    const cases = [
      decideGenreAssignment(current({ genreSource: GenreSource.MANUAL }), result('g', 90), {
        now: NOW,
      }),
      decideGenreAssignment(current(), result('g', 90), { now: NOW }),
      decideGenreAssignment(current(), result(null, null), { now: NOW }),
    ];
    for (const decision of cases) {
      expect(decision.reason.length).toBeGreaterThan(0);
    }
  });

  it('assign reasons embed the engine explanation (§4.6)', () => {
    const decision = decideGenreAssignment(current(), result('g-new', 95), { now: NOW });
    expect(decision.reason).toContain('KSD category "Фентезі"');
    expect(decision.reason).toContain('95');
  });
});

describe('applyGenreAssignment', () => {
  function makePrisma(): { prisma: PrismaClient; update: ReturnType<typeof vi.fn> } {
    const update = vi.fn(async () => ({}));
    return { prisma: { canonicalBook: { update } } as unknown as PrismaClient, update };
  }

  it('writes the decision data and returns true', async () => {
    const { prisma, update } = makePrisma();
    const decision = decideGenreAssignment(current(), result('g-new', 90), { now: NOW });
    const wrote = await applyGenreAssignment(prisma, 'book-1', decision);

    expect(wrote).toBe(true);
    expect(update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'book-1' },
      data: {
        genreId: 'g-new',
        genreSource: GenreSource.PROVIDER_MAPPING,
        genreConfidence: 90,
        genreUpdatedAt: NOW,
      },
    });
  });

  it('writes the all-null clear-stale payload', async () => {
    const { prisma, update } = makePrisma();
    const decision = decideGenreAssignment(
      current({ genreId: 'g-old', genreSource: GenreSource.PROVIDER_MAPPING, genreConfidence: 80 }),
      result(null, null),
      { clearStale: true, now: NOW },
    );
    const wrote = await applyGenreAssignment(prisma, 'book-1', decision);

    expect(wrote).toBe(true);
    expect(update).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'book-1' },
      data: { genreId: null, genreSource: null, genreConfidence: null, genreUpdatedAt: null },
    });
  });

  it('performs zero writes for keep/manual-locked decisions', async () => {
    const { prisma, update } = makePrisma();
    const keep = decideGenreAssignment(current(), result(null, null), { now: NOW });
    const locked = decideGenreAssignment(
      current({ genreSource: GenreSource.MANUAL }),
      result('g', 100),
      { now: NOW },
    );

    expect(await applyGenreAssignment(prisma, 'book-1', keep)).toBe(false);
    expect(await applyGenreAssignment(prisma, 'book-1', locked)).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('loadEngineContext', () => {
  it('builds the engine context from genre_mappings and TAXONOMIC rows', async () => {
    const genreMappingFindMany = vi.fn(async () => [
      { provider: 'BOOK_CLUB', sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 95 },
      { provider: 'KNIGOLAND', sourceCategory: 'книги', genreId: null, confidence: 100 },
    ]);
    const collectionFindMany = vi.fn(async () => [{ id: 'g-fentezi', slug: 'fentezi' }]);
    const prisma = {
      genreMapping: { findMany: genreMappingFindMany },
      collection: { findMany: collectionFindMany },
    } as unknown as PrismaClient;

    const ctx = await loadEngineContext(prisma);

    expect(ctx.rulesByProvider.get('book-club')?.get('фентезі')).toEqual({
      genreId: 'g-fentezi',
      confidence: 95,
    });
    expect(ctx.rulesByProvider.get('knigoland')?.get('книги')).toEqual({
      genreId: null,
      confidence: 100,
    });
    expect(ctx.slugByGenreId.get('g-fentezi')).toBe('fentezi');
    // Aliases come from the checked-in taxonomy, joined by slug.
    expect(ctx.aliasToGenreId.get('fantasy')).toBe('g-fentezi');
    expect(collectionFindMany).toHaveBeenCalledWith({
      where: { type: 'TAXONOMIC' },
      select: { id: true, slug: true },
    });
  });
});
