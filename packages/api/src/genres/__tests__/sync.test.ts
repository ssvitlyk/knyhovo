import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { CANONICAL_GENRES } from '../taxonomy.js';
import { syncGenres } from '../sync.js';

/**
 * Row shape returned by our mocked `collection.findMany`/`upsert`. Only the
 * fields `syncGenres` reads/writes are modeled — this is a hand-rolled mock
 * rather than `fake-prisma.ts` (collections/__tests__) because that helper
 * doesn't implement `collection.upsert`/`collection.update`, which this
 * module needs and the existing collections tests don't.
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

function makeMockPrisma(initialRows: Row[]): { prisma: PrismaClient; rows: Row[] } {
  const rows = [...initialRows];
  let nextId = rows.length;

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

  const prisma = {
    collection: { findMany, upsert, update },
  } as unknown as PrismaClient;

  return { prisma, rows };
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

describe('syncGenres', () => {
  it('creates all 17 genres from an empty collections table', async () => {
    const { prisma, rows } = makeMockPrisma([]);
    const result = await syncGenres(prisma);

    expect(result).toEqual({ created: 17, updated: 0, deactivated: 0, dryRun: false });
    expect(rows).toHaveLength(17);
    expect(rows.map((r) => r.slug).sort()).toEqual(CANONICAL_GENRES.map((g) => g.slug).sort());
  });

  it('is idempotent: a second run with no taxonomy changes writes nothing', async () => {
    const { prisma } = makeMockPrisma([]);
    await syncGenres(prisma);
    const second = await syncGenres(prisma);

    expect(second).toEqual({ created: 0, updated: 0, deactivated: 0, dryRun: false });
  });

  it('updates name on a rename but never writes slug', async () => {
    const initial = CANONICAL_GENRES.map((g) => rowFromGenre(g));
    // Simulate a stale DB name for one genre; taxonomy.ts is the source of truth.
    const staleIndex = initial.findIndex((r) => r.slug === 'fentezi');
    initial[staleIndex] = { ...initial[staleIndex], name: 'Old Fantasy Name' };
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
    expect(rows[staleIndex].name).toBe('Stale Name');
  });

  it('dry-run on an empty table reports 17 would-be-created, writes nothing', async () => {
    const { prisma, rows } = makeMockPrisma([]);
    const result = await syncGenres(prisma, { dryRun: true });

    expect(result).toEqual({ created: 17, updated: 0, deactivated: 0, dryRun: true });
    expect(rows).toHaveLength(0);
  });
});
