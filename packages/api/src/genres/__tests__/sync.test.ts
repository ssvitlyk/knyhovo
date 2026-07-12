import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { CANONICAL_GENRES } from '../taxonomy.js';
import { GENRE_MAPPINGS_SEED } from '../mappings.seed.js';
import { syncGenres } from '../sync.js';
import { mapProviderName } from '../../pipeline/persist-listing.js';

/**
 * Row shapes returned by our mocked Prisma. Only the fields `syncGenres`
 * reads/writes are modeled — this is a hand-rolled mock rather than
 * `fake-prisma.ts` (collections/__tests__) because that helper doesn't
 * implement `collection.upsert`/`collection.update`/`genreMapping.*`, which
 * this module needs and the existing collections tests don't.
 */
interface Row {
  id: string;
  slug: string;
  type: 'TAXONOMIC';
  name: string;
  description: string;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface MappingRow {
  id: string;
  provider: string;
  sourceCategory: string;
  genreId: string | null;
  confidence: number;
  notes: string | null;
}

function makeMockPrisma(
  initialRows: Row[],
  initialMappings: MappingRow[] = [],
): { prisma: PrismaClient; rows: Row[]; mappings: MappingRow[] } {
  const rows = [...initialRows];
  const mappings = [...initialMappings];
  let nextId = rows.length;
  let nextMappingId = mappings.length;

  const findMany = vi.fn(async ({ where }: { where?: { type?: string } } = {}) => {
    if (where?.type) return rows.filter((r) => r.type === where.type).map((r) => ({ ...r }));
    return rows.map((r) => ({ ...r }));
  });

  const upsert = vi.fn(
    async ({
      where,
      update,
      create,
    }: {
      where: { slug: string };
      update: Partial<Row>;
      create: Omit<Row, 'id'>;
    }) => {
      const existing = rows.find((r) => r.slug === where.slug);
      if (existing) {
        Object.assign(existing, update);
        return { ...existing };
      }
      const created: Row = { id: `new-${nextId++}`, ...create };
      rows.push(created);
      return { ...created };
    },
  );

  const update = vi.fn(
    async ({ where, data }: { where: { slug: string }; data: Partial<Row> }) => {
      const existing = rows.find((r) => r.slug === where.slug);
      if (!existing) throw new Error(`no row for slug ${where.slug}`);
      Object.assign(existing, data);
      return { ...existing };
    },
  );

  const mappingFindMany = vi.fn(async () => mappings.map((m) => ({ ...m })));

  const mappingUpsert = vi.fn(
    async ({
      where,
      update: updateData,
      create,
    }: {
      where: { provider_sourceCategory: { provider: string; sourceCategory: string } };
      update: Partial<MappingRow>;
      create: Omit<MappingRow, 'id'>;
    }) => {
      const key = where.provider_sourceCategory;
      const existing = mappings.find(
        (m) => m.provider === key.provider && m.sourceCategory === key.sourceCategory,
      );
      if (existing) {
        Object.assign(existing, updateData);
        return { ...existing };
      }
      const created: MappingRow = { id: `map-${nextMappingId++}`, ...create };
      mappings.push(created);
      return { ...created };
    },
  );

  const prisma = {
    collection: { findMany, upsert, update },
    genreMapping: { findMany: mappingFindMany, upsert: mappingUpsert },
  } as unknown as PrismaClient;

  return { prisma, rows, mappings };
}

function rowFromGenre(genre: (typeof CANONICAL_GENRES)[number], overrides: Partial<Row> = {}): Row {
  return {
    id: `id-${genre.slug}`,
    slug: genre.slug,
    type: 'TAXONOMIC',
    name: genre.name,
    description: genre.description,
    icon: genre.icon,
    displayOrder: genre.displayOrder,
    isActive: true,
    ...overrides,
  };
}

const SEED_COUNT = GENRE_MAPPINGS_SEED.length;

describe('syncGenres — taxonomy rows', () => {
  it('creates all 17 genres (and all seed mappings) from an empty database', async () => {
    const { prisma, rows, mappings } = makeMockPrisma([]);
    const result = await syncGenres(prisma);

    expect(result).toEqual({
      created: 17,
      updated: 0,
      deactivated: 0,
      mappingsCreated: SEED_COUNT,
      mappingsUpdated: 0,
      dryRun: false,
    });
    expect(rows).toHaveLength(17);
    expect(rows.map((r) => r.slug).sort()).toEqual(CANONICAL_GENRES.map((g) => g.slug).sort());
    expect(mappings).toHaveLength(SEED_COUNT);
  });

  it('is idempotent: a second run with no registry changes writes nothing', async () => {
    const { prisma } = makeMockPrisma([]);
    await syncGenres(prisma);
    const second = await syncGenres(prisma);

    expect(second).toEqual({
      created: 0,
      updated: 0,
      deactivated: 0,
      mappingsCreated: 0,
      mappingsUpdated: 0,
      dryRun: false,
    });
  });

  it('updates name on a rename but never writes slug', async () => {
    const initial = CANONICAL_GENRES.map((g) => rowFromGenre(g));
    // Simulate a stale DB name for one genre; taxonomy.ts is the source of truth.
    const staleIndex = initial.findIndex((r) => r.slug === 'fentezi');
    initial[staleIndex] = { ...initial[staleIndex]!, name: 'Old Fantasy Name' };
    const { prisma, rows } = makeMockPrisma(initial);

    const result = await syncGenres(prisma);

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    const updatedRow = rows.find((r) => r.slug === 'fentezi');
    expect(updatedRow?.name).toBe('Фентезі');
    expect(updatedRow?.slug).toBe('fentezi');
  });

  it('deactivates (never deletes) a TAXONOMIC row whose slug left the taxonomy', async () => {
    const initial = [
      ...CANONICAL_GENRES.map((g) => rowFromGenre(g)),
      rowFromGenre(
        { slug: 'retired-genre', key: 'retired', name: 'Retired', description: 'x', icon: 'x', displayOrder: 99, aliases: [] },
        { id: 'id-retired' },
      ),
    ];
    const { prisma, rows } = makeMockPrisma(initial);

    const result = await syncGenres(prisma);

    expect(result.deactivated).toBe(1);
    const retired = rows.find((r) => r.slug === 'retired-genre');
    expect(retired).toBeDefined();
    expect(retired?.isActive).toBe(false);
  });

  it('dry-run computes the diff but performs zero writes', async () => {
    const staleIndex = 0;
    const initial = CANONICAL_GENRES.map((g, i) =>
      i === staleIndex ? rowFromGenre(g, { name: 'Stale Name' }) : rowFromGenre(g),
    );
    const { prisma, rows } = makeMockPrisma(initial);

    const result = await syncGenres(prisma, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.updated).toBe(1);
    // No writes: the stale row is untouched.
    expect(rows[staleIndex]!.name).toBe('Stale Name');
  });

  it('dry-run on an empty table reports 17 would-be-created, writes nothing', async () => {
    const { prisma, rows, mappings } = makeMockPrisma([]);
    const result = await syncGenres(prisma, { dryRun: true });

    expect(result).toEqual({
      created: 17,
      updated: 0,
      deactivated: 0,
      mappingsCreated: SEED_COUNT,
      mappingsUpdated: 0,
      dryRun: true,
    });
    expect(rows).toHaveLength(0);
    expect(mappings).toHaveLength(0);
  });
});

describe('syncGenres — genre_mappings rows (G3)', () => {
  function mappingRowFromSeed(
    entry: (typeof GENRE_MAPPINGS_SEED)[number],
    overrides: Partial<MappingRow> = {},
  ): MappingRow {
    return {
      id: `map-${entry.provider}-${entry.sourceCategory}`,
      provider: mapProviderName(entry.provider),
      sourceCategory: entry.sourceCategory,
      genreId: entry.genreSlug === null ? null : `id-${entry.genreSlug}`,
      confidence: entry.confidence,
      notes: entry.notes,
      ...overrides,
    };
  }

  it('resolves genreSlug to the TAXONOMIC row id and stores Prisma provider names', async () => {
    const { prisma, mappings } = makeMockPrisma(CANONICAL_GENRES.map((g) => rowFromGenre(g)));
    await syncGenres(prisma);

    const fentezi = mappings.find(
      (m) => m.provider === 'BOOKCHEF' && m.sourceCategory === 'фентезі',
    );
    expect(fentezi?.genreId).toBe('id-fentezi');
    expect(fentezi?.confidence).toBe(95);
  });

  it('persists ignore rules with genreId null', async () => {
    const { prisma, mappings } = makeMockPrisma(CANONICAL_GENRES.map((g) => rowFromGenre(g)));
    await syncGenres(prisma);

    const ignore = mappings.find(
      (m) => m.provider === 'KNIGOLAND' && m.sourceCategory === 'книги',
    );
    expect(ignore).toBeDefined();
    expect(ignore?.genreId).toBeNull();
  });

  it('updates a drifted row back to the seed values', async () => {
    const drifted = GENRE_MAPPINGS_SEED.map((e) => mappingRowFromSeed(e));
    drifted[0] = { ...drifted[0]!, confidence: 10, notes: 'drifted' };
    const { prisma, mappings } = makeMockPrisma(
      CANONICAL_GENRES.map((g) => rowFromGenre(g)),
      drifted,
    );

    const result = await syncGenres(prisma);

    expect(result.mappingsCreated).toBe(0);
    expect(result.mappingsUpdated).toBe(1);
    const seedEntry = GENRE_MAPPINGS_SEED[0]!;
    const row = mappings.find(
      (m) =>
        m.provider === mapProviderName(seedEntry.provider) &&
        m.sourceCategory === seedEntry.sourceCategory,
    );
    expect(row?.confidence).toBe(seedEntry.confidence);
    expect(row?.notes).toBe(seedEntry.notes);
  });

  it('never deletes rows that are absent from the seed (ad-hoc DB curation survives)', async () => {
    const adHoc: MappingRow = {
      id: 'map-adhoc',
      provider: 'VIVAT',
      sourceCategory: 'кулінарія',
      genreId: null,
      confidence: 80,
      notes: 'curated directly in DB',
    };
    const { prisma, mappings } = makeMockPrisma(
      CANONICAL_GENRES.map((g) => rowFromGenre(g)),
      [...GENRE_MAPPINGS_SEED.map((e) => mappingRowFromSeed(e)), adHoc],
    );

    const result = await syncGenres(prisma);

    expect(result.mappingsCreated).toBe(0);
    expect(result.mappingsUpdated).toBe(0);
    expect(mappings.find((m) => m.id === 'map-adhoc')).toEqual(adHoc);
  });

  it('newly created genres are immediately mappable in the same run', async () => {
    // Empty DB: genres and mappings are both created in one pass.
    const { prisma, mappings, rows } = makeMockPrisma([]);
    await syncGenres(prisma);

    const fentezi = mappings.find(
      (m) => m.provider === 'BOOKCHEF' && m.sourceCategory === 'фентезі',
    );
    const genreRow = rows.find((r) => r.slug === 'fentezi');
    expect(fentezi?.genreId).toBe(genreRow?.id);
  });
});
