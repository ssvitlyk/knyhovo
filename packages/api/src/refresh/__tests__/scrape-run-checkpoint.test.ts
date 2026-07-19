import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { checkpointScrapeRunCounters, summarizeScrapeErrors } from '../scrape-run.repository.js';

const COUNTERS = {
  itemsFound: 100,
  itemsUpdated: 40,
  errorsCount: 3,
  errorSummary: 'Product x: HTTP 500',
};

function prismaWithUpdateMany(
  impl: () => Promise<{ count: number }>,
): { prisma: PrismaClient; updateMany: ReturnType<typeof vi.fn> } {
  const updateMany = vi.fn(impl);
  return { prisma: { scrapeRun: { updateMany } } as unknown as PrismaClient, updateMany };
}

describe('checkpointScrapeRunCounters', () => {
  it('writes counters gated on status RUNNING and reports success', async () => {
    const { prisma, updateMany } = prismaWithUpdateMany(() => Promise.resolve({ count: 1 }));
    await expect(checkpointScrapeRunCounters(prisma, 'run-1', COUNTERS)).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', status: 'RUNNING' },
      data: COUNTERS,
    });
  });

  it('reports false for a run that is no longer RUNNING (closed/reaped) — never modifies it', async () => {
    const { prisma } = prismaWithUpdateMany(() => Promise.resolve({ count: 0 }));
    await expect(checkpointScrapeRunCounters(prisma, 'run-1', COUNTERS)).resolves.toBe(false);
  });

  it('swallows write failures and reports false — a failed checkpoint never kills the run', async () => {
    const { prisma } = prismaWithUpdateMany(() => Promise.reject(new Error('connection lost')));
    await expect(checkpointScrapeRunCounters(prisma, 'run-1', COUNTERS)).resolves.toBe(false);
  });
});

describe('summarizeScrapeErrors', () => {
  it('returns null for an empty list', () => {
    expect(summarizeScrapeErrors([])).toBeNull();
  });

  it('joins the first 5 messages and truncates to 1000 chars', () => {
    const errors = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
    expect(summarizeScrapeErrors(errors)).toBe('e1; e2; e3; e4; e5');
    const long = 'x'.repeat(600);
    expect(summarizeScrapeErrors([long, long])).toHaveLength(1000);
  });
});
