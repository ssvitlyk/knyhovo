import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { RawProviderListing } from '@knyhovo/shared';
import { maybeAdvanceWatermark } from '../persist-listing.js';

const SCRAPED_AT = new Date('2026-07-01T00:00:00.000Z');

function makeDb() {
  const upsert = vi.fn(async () => ({}));
  return { db: { providerScrapeState: { upsert } } as unknown as PrismaClient, upsert };
}

function listing(extra: Partial<RawProviderListing>): RawProviderListing {
  return { provider: 'bookchef', url: 'https://bookchef.com.ua/a', ...extra } as RawProviderListing;
}

describe('maybeAdvanceWatermark', () => {
  it('does nothing when the listing carries no sourceLastmod signal', async () => {
    const { db, upsert } = makeDb();
    await maybeAdvanceWatermark(db, listing({}), SCRAPED_AT);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('upserts the watermark for a string sourceLastmod', async () => {
    const { db, upsert } = makeDb();
    await maybeAdvanceWatermark(db, listing({ sourceLastmod: '2026-06-30T00:00:00.000Z' }), SCRAPED_AT);
    expect(upsert).toHaveBeenCalledOnce();
    const args = (upsert.mock.calls[0] as unknown as [{ where: unknown; create: { sourceLastmod: Date | null } }])[0];
    expect(args.where).toEqual({ provider_url: { provider: 'BOOKCHEF', url: 'https://bookchef.com.ua/a' } });
    expect(args.create.sourceLastmod).toEqual(new Date('2026-06-30T00:00:00.000Z'));
  });

  it('still records an explicit null sourceLastmod', async () => {
    const { db, upsert } = makeDb();
    await maybeAdvanceWatermark(db, listing({ sourceLastmod: null }), SCRAPED_AT);
    expect(upsert).toHaveBeenCalledOnce();
    const args = (upsert.mock.calls[0] as unknown as [{ create: { sourceLastmod: Date | null } }])[0];
    expect(args.create.sourceLastmod).toBeNull();
  });
});
