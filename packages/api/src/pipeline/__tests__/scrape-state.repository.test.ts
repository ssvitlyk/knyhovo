import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { Provider } from '@prisma/client';
import {
  loadKnownSourceLastmod,
  recordSitemapPresence,
  advanceWatermark,
  countVanished,
  sweepStaleState,
} from '../scrape-state.repository.js';

// ── Fixed test dates ──────────────────────────────────────────────────────────
const SEEN_AT = new Date('2026-07-14T00:00:00.000Z');
const FETCHED_AT = new Date('2026-07-14T00:00:00.000Z');

// ── Fake Prisma factory ───────────────────────────────────────────────────────
function makeFakePrisma() {
  return {
    providerScrapeState: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    $executeRaw: vi.fn(async () => 0),
  } as unknown as PrismaClient;
}

// ── loadKnownSourceLastmod ────────────────────────────────────────────────────

describe('loadKnownSourceLastmod', () => {
  it('calls findMany with the right where/select and builds a url → ISO string map', async () => {
    const prisma = makeFakePrisma();
    vi.mocked(prisma.providerScrapeState.findMany).mockResolvedValue([
      { url: 'https://bookchef.com.ua/a', sourceLastmod: new Date('2026-07-01T00:00:00.000Z') },
      { url: 'https://bookchef.com.ua/b', sourceLastmod: new Date('2026-07-02T00:00:00.000Z') },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake Prisma row shape doesn't need every column
    ] as any);

    const map = await loadKnownSourceLastmod(prisma, Provider.BOOKCHEF);

    expect(prisma.providerScrapeState.findMany).toHaveBeenCalledWith({
      where: { provider: Provider.BOOKCHEF, sourceLastmod: { not: null } },
      select: { url: true, sourceLastmod: true },
    });
    expect(map.size).toBe(2);
    expect(map.get('https://bookchef.com.ua/a')).toBe('2026-07-01T00:00:00.000Z');
    expect(map.get('https://bookchef.com.ua/b')).toBe('2026-07-02T00:00:00.000Z');
  });

  it('returns an empty map when findMany returns no rows', async () => {
    const prisma = makeFakePrisma();
    vi.mocked(prisma.providerScrapeState.findMany).mockResolvedValue([]);

    const map = await loadKnownSourceLastmod(prisma, Provider.BOOKCHEF);
    expect(map.size).toBe(0);
  });
});

// ── recordSitemapPresence ─────────────────────────────────────────────────────

describe('recordSitemapPresence', () => {
  it('issues exactly one $executeRaw call for a small entry list (single chunk)', async () => {
    const prisma = makeFakePrisma();
    const entries = [{ url: 'https://x/1' }, { url: 'https://x/2' }, { url: 'https://x/3' }];

    await recordSitemapPresence(prisma, Provider.BOOKCHEF, entries, SEEN_AT);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('chunks into two $executeRaw calls for >2000 entries', async () => {
    const prisma = makeFakePrisma();
    const entries = Array.from({ length: 2500 }, (_, i) => ({ url: `https://x/${i}` }));

    await recordSitemapPresence(prisma, Provider.BOOKCHEF, entries, SEEN_AT);

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('does not call $executeRaw when entries is empty', async () => {
    const prisma = makeFakePrisma();

    await recordSitemapPresence(prisma, Provider.BOOKCHEF, [], SEEN_AT);

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  // Regression: `Provider.BOOKCHEF` (the Prisma JS enum key) is the uppercase
  // string "BOOKCHEF", but the Postgres `provider` enum's actual label is
  // lowercase "bookchef" (see @map in schema.prisma). Interpolating the raw
  // enum key into a `::"provider"` cast previously produced
  // `invalid input value for enum provider: "BOOKCHEF"` in production.
  it('interpolates the lowercase DB label ("bookchef"), never the uppercase enum key', async () => {
    const prisma = makeFakePrisma();
    const entries = [{ url: 'https://x/1' }];

    await recordSitemapPresence(prisma, Provider.BOOKCHEF, entries, SEEN_AT);

    const callArgs = vi.mocked(prisma.$executeRaw).mock.calls[0]!;
    const interpolatedValues = callArgs.flatMap((arg) =>
      arg !== null && typeof arg === 'object' && 'values' in arg
        ? (arg as { values: unknown[] }).values
        : [arg],
    );

    expect(interpolatedValues).toContain('bookchef');
    expect(interpolatedValues).not.toContain('BOOKCHEF');
  });
});

// ── advanceWatermark ──────────────────────────────────────────────────────────

describe('advanceWatermark', () => {
  it('upserts with provider_url where and sourceLastmod converted to a Date', async () => {
    const prisma = makeFakePrisma();

    await advanceWatermark(
      prisma,
      Provider.BOOKCHEF,
      'https://bookchef.com.ua/a',
      '2026-07-01T00:00:00.000Z',
      FETCHED_AT,
    );

    expect(prisma.providerScrapeState.upsert).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(prisma.providerScrapeState.upsert).mock.calls[0]![0];
    expect(callArgs.where).toEqual({
      provider_url: { provider: Provider.BOOKCHEF, url: 'https://bookchef.com.ua/a' },
    });
    expect(callArgs.create.sourceLastmod).toEqual(new Date('2026-07-01T00:00:00.000Z'));
    expect(callArgs.create.lastFetchedAt).toEqual(FETCHED_AT);
    expect(callArgs.create.lastSeenInSitemapAt).toEqual(FETCHED_AT);
    expect(callArgs.update.sourceLastmod).toEqual(new Date('2026-07-01T00:00:00.000Z'));
    expect(callArgs.update.lastFetchedAt).toEqual(FETCHED_AT);
    expect(callArgs.update.lastSeenInSitemapAt).toEqual(FETCHED_AT);
  });

  it('passes sourceLastmod through as null when given null', async () => {
    const prisma = makeFakePrisma();

    await advanceWatermark(prisma, Provider.BOOKCHEF, 'https://bookchef.com.ua/a', null, FETCHED_AT);

    const callArgs = vi.mocked(prisma.providerScrapeState.upsert).mock.calls[0]![0];
    expect(callArgs.create.sourceLastmod).toBeNull();
    expect(callArgs.update.sourceLastmod).toBeNull();
  });
});

// ── countVanished ─────────────────────────────────────────────────────────────

describe('countVanished', () => {
  it('calls count with lastSeenInSitemapAt lt seenAt and returns the result', async () => {
    const prisma = makeFakePrisma();
    vi.mocked(prisma.providerScrapeState.count).mockResolvedValue(7);

    const result = await countVanished(prisma, Provider.BOOKCHEF, new Set(['https://x/1']), SEEN_AT);

    expect(prisma.providerScrapeState.count).toHaveBeenCalledWith({
      where: { provider: Provider.BOOKCHEF, lastSeenInSitemapAt: { lt: SEEN_AT } },
    });
    expect(result).toBe(7);
  });
});

// ── sweepStaleState ───────────────────────────────────────────────────────────

describe('sweepStaleState', () => {
  it('calls deleteMany with lastSeenInSitemapAt lt cutoff and returns the deleted count', async () => {
    const prisma = makeFakePrisma();
    vi.mocked(prisma.providerScrapeState.deleteMany).mockResolvedValue({ count: 12 });

    const result = await sweepStaleState(prisma, Provider.BOOKCHEF, SEEN_AT);

    expect(prisma.providerScrapeState.deleteMany).toHaveBeenCalledWith({
      where: { provider: Provider.BOOKCHEF, lastSeenInSitemapAt: { lt: SEEN_AT } },
    });
    expect(result).toBe(12);
  });
});
