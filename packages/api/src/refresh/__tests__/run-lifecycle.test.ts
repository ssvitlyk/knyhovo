import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ScrapeRunStatus } from '@prisma/client';

vi.mock('../scrape-run.repository.js', () => ({
  finishScrapeRun: vi.fn(),
}));

import { closeRunAsFailed } from '../run-lifecycle.js';
import { finishScrapeRun } from '../scrape-run.repository.js';
import { createMetrics } from '../../pipeline/metrics.js';

const STARTED = new Date('2026-01-01T00:00:00Z');
const FINISHED = new Date('2026-01-01T00:05:00Z');

function makeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

describe('closeRunAsFailed', () => {
  beforeEach(() => {
    vi.mocked(finishScrapeRun).mockReset();
  });

  it('closes the run as FAILED with the message as sole error', async () => {
    const prisma = { $queryRaw: vi.fn() } as unknown as PrismaClient;
    const metrics = createMetrics();
    await closeRunAsFailed(prisma, makeLogger(), {
      runId: 'r1', startedAt: STARTED, finishedAt: FINISHED, provider: 'vivat', metrics, message: 'boom',
    });
    expect(finishScrapeRun).toHaveBeenCalledWith(prisma, 'r1', {
      startedAt: STARTED,
      finishedAt: FINISHED,
      status: ScrapeRunStatus.FAILED,
      metrics,
      scrapeErrors: ['boom'],
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('touches the connection first (and survives a failing touch) when asked', async () => {
    const queryRaw = vi.fn().mockRejectedValue(new Error('conn dropped'));
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaClient;
    await closeRunAsFailed(prisma, makeLogger(), {
      runId: 'r1', startedAt: STARTED, finishedAt: FINISHED, provider: 'vivat',
      metrics: createMetrics(), message: 'boom', touchConnectionFirst: true,
    });
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(finishScrapeRun).toHaveBeenCalledOnce();
  });

  it('logs and swallows a failed close', async () => {
    vi.mocked(finishScrapeRun).mockRejectedValue(new Error('db down'));
    const logger = makeLogger();
    await expect(
      closeRunAsFailed({} as PrismaClient, logger, {
        runId: 'r9', startedAt: STARTED, finishedAt: FINISHED, provider: 'vivat',
        metrics: createMetrics(), message: 'boom',
      }),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('Failed to finalize run r9 for vivat: db down');
  });
});
