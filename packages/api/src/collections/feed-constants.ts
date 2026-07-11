/**
 * Shared constants for dynamic feed pool composition (`novynky`, `ponyzhena-tsina`).
 *
 * Lives in its own module so both `repository.ts` (SQL pool composition) and
 * `service.ts` (pagination/TTL orchestration) can depend on the same values
 * without a circular import between the two.
 */

export const NEW_ARRIVALS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Minimum size for the novynky pool before falling back to older priced books. */
export const NOVYNKY_MIN_POOL = 24;
/**
 * Upper bound on the novynky pool, expressed as a share of the whole priced
 * catalog rather than a flat count — so it scales with catalog size instead
 * of needing re-tuning as the catalog grows. `createdAt` is the ingestion
 * (scrape) timestamp, not the book's actual publish date — it's the only
 * "new" signal available, but a bulk backfill/re-scrape run makes it cluster
 * within the 30-day window for most of the catalog at once. New arrivals are,
 * by definition, a minority of an established catalog; if the window's real
 * size exceeds this share, that's the backfill artifact, not organic growth.
 */
export const NOVYNKY_MAX_SHARE = 0.25;
export const PRICE_DROP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Pure decision: given how many priced books fall inside the novynky window
 * and how many priced books exist overall, decide the pool's final size and
 * whether it needs the older-books fallback top-up.
 *
 * Mirrors the pre-SQL-C1 in-JS logic (service.ts `computeDynamicPool` /
 * `novynky` case) exactly — extracted so both the SQL builder and its unit
 * tests can exercise the cap/fallback decision without a database.
 */
export interface NovynkyPoolPlan {
  /** Rows to take from the in-window pool (newest-first). */
  readonly windowLimit: number;
  /** Rows to take from the pre-window fallback pool (newest-first), if any. */
  readonly fallbackLimit: number;
}

export function planNovynkyPool(windowCount: number, totalPriced: number): NovynkyPoolPlan {
  if (windowCount >= NOVYNKY_MIN_POOL) {
    const maxPool = Math.max(NOVYNKY_MIN_POOL, Math.floor(totalPriced * NOVYNKY_MAX_SHARE));
    return { windowLimit: Math.min(maxPool, windowCount), fallbackLimit: 0 };
  }
  return { windowLimit: windowCount, fallbackLimit: NOVYNKY_MIN_POOL - windowCount };
}
