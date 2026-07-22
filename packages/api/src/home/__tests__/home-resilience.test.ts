import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearCache } from '../../collections/cache.js';
import { fixedClock } from '../../clock.js';
import { emptyDb, makeFakePrisma, book, listing, collection, itemsFor } from './fixtures.js';
import type { FakeDb } from './fixtures.js';

// Hoisted switches let a single test toggle a mocked failure without breaking
// the others (vi.mock factories are hoisted above imports).
const hoisted = vi.hoisted(() => ({ throwNovynkyFeed: false, throwCanonicalFetch: false }));

// Feed SQL → pure-JS equivalents; plus an injectable failure on the canonical
// batch-fetch to prove the resilience catch is scoped to feed fetches only.
vi.mock('../../collections/repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../collections/repository.js')>();
  const { fakeFeedRepositoryOverrides } = await import('../../collections/__tests__/fake-feed-repository.js');
  return {
    ...actual,
    ...fakeFeedRepositoryOverrides(),
    findCanonicalBooksByIds: async (prisma: unknown, ids: readonly string[]) => {
      if (hoisted.throwCanonicalFetch) throw new Error('canonical fetch boom');
      return actual.findCanonicalBooksByIds(prisma as never, ids);
    },
  };
});

// Wrap the narrow feed-candidate port so one feed (novynky) can be made to reject.
vi.mock('../../collections/service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../collections/service.js')>();
  return {
    ...actual,
    loadFeedCandidateIds: async (prisma: unknown, row: { slug: string }, limit: number, now: Date) => {
      if (hoisted.throwNovynkyFeed && row.slug === 'novynky') throw new Error('novynky feed boom');
      return actual.loadFeedCandidateIds(prisma as never, row as never, limit, now);
    },
  };
});

// Import AFTER the mocks so buildHome binds the mocked `loadFeedCandidateIds`.
const { buildHome } = await import('../service.js');

const NOW = new Date('2026-07-03T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * DAY_MS);
const SILENT = { clock: fixedClock(NOW), logSink: () => {} };

function threeFeedDb(): FakeDb {
  const db = emptyDb();
  db.collections.push(
    collection('col-knyhovyk', 'knyhovyk-radyt', 'EDITORIAL'),
    collection('col-novynky', 'novynky', 'DYNAMIC'),
    collection('col-popular', 'populyarne-zaraz', 'DYNAMIC'),
  );
  // 12 curated (editorial) books, all also in the popular WHERE-TRUE pool.
  for (let i = 0; i < 12; i += 1) {
    db.books.push(book(`e${i}`, `E${i}`, 'A', { createdAt: daysAgo(2), listings: [listing(1000 + i)] }));
  }
  db.collectionItems.push(...itemsFor('col-knyhovyk', Array.from({ length: 12 }, (_, i) => `e${i}`)));
  // 12 popular-only books.
  for (let i = 0; i < 12; i += 1) {
    db.books.push(book(`p${i}`, `P${i}`, 'A', { createdAt: daysAgo(3), listings: [listing(2000 + i)] }));
  }
  return db;
}

describe('buildHome — partial feed resilience', () => {
  beforeEach(() => {
    hoisted.throwNovynkyFeed = false;
    hoisted.throwCanonicalFetch = false;
    clearCache();
  });

  it('one rejected feed → its shelf is absent, the other shelves still compose, dedup preserved', async () => {
    hoisted.throwNovynkyFeed = true;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const home = await buildHome(makeFakePrisma(threeFeedDb()), SILENT);
    const keys = home.shelves.map((s) => s.key);

    // novynky failed → omitted; popular + knyhovyk survived.
    expect(keys).not.toContain('novynky');
    expect(keys).toContain('popular');
    expect(keys).toContain('knyhovyk');

    // Cross-section dedup preserved among the surviving shelves.
    const all = home.shelves.flatMap((s) => s.books.map((b) => b.id));
    expect(new Set(all).size).toBe(all.length);

    // Structured, PII-free failure log with section key + slug.
    const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('home.feed_fetch_failed');
    expect(logged).toContain('novynky');
    errorSpy.mockRestore();
  });

  it('does NOT swallow non-feed (programmer) errors — a failed canonical fetch propagates', async () => {
    hoisted.throwCanonicalFetch = true;
    await expect(buildHome(makeFakePrisma(threeFeedDb()), SILENT)).rejects.toThrow('canonical fetch boom');
  });
});
