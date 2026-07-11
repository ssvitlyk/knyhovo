/**
 * Minimal per-process in-memory cache for the Collections endpoints.
 *
 * There is no shared cache table/layer for collections yet — this is a
 * process-local `Map` with a TTL per key. It is intentionally simple:
 * no eviction beyond lazy expiry-on-read, no cross-process invalidation.
 * Good enough for the read-mostly, short-TTL collections endpoints.
 *
 * Resilience notes (fix/collections-cache-stampede):
 *  - In-flight builds are coalesced per key so concurrent misses for the
 *    same key share a single factory call instead of each running it.
 *  - Expired entries are served stale immediately while a single
 *    background refresh runs (stale-while-revalidate), so callers never
 *    block on a slow factory just because the TTL lapsed.
 *  - A small global semaphore caps how many distinct-key factories can run
 *    at once, so a cold cache across many collections (e.g. the /dobirky
 *    page firing ~11 requests at once) doesn't saturate the small Railway
 *    instance and trip the proxy's 502s.
 */

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Promises for factory builds currently in flight, keyed by cache key. */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Max number of distinct-key factories allowed to run concurrently.
 * Keeps a cold-cache burst (e.g. /dobirky's ~11 parallel shelf requests)
 * to waves of at most this many concurrent heavy builds, rather than all
 * firing at once and saturating the small Railway instance (502s).
 */
const MAX_CONCURRENT_FACTORIES = 4;

let runningFactories = 0;
const semaphoreQueue: Array<() => void> = [];

/** Acquire a semaphore slot, waiting FIFO if the limit is already reached. */
async function acquireSlot(): Promise<void> {
  if (runningFactories < MAX_CONCURRENT_FACTORIES) {
    runningFactories += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    semaphoreQueue.push(resolve);
  });
  runningFactories += 1;
}

/** Release a semaphore slot, waking the next FIFO waiter if any. */
function releaseSlot(): void {
  runningFactories -= 1;
  const next = semaphoreQueue.shift();
  if (next) {
    next();
  }
}

/** Run `factory` under the concurrency semaphore. */
async function runFactory<T>(factory: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await factory();
  } finally {
    releaseSlot();
  }
}

/**
 * Build (or join an in-progress build of) `key` via `factory`, coalescing
 * concurrent callers onto a single semaphore-gated promise.
 */
function coalescedBuild<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = runFactory(factory).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/**
 * Return the cached value for `key` if still fresh; otherwise compute it via
 * `factory`, cache it for `ttlMs`, and return it.
 *
 * - Fresh hit: returned synchronously (no factory call).
 * - Cold miss (no entry, or an in-flight build already exists): all
 *   concurrent callers await the same coalesced factory call; a rejection
 *   is not cached and propagates to every waiter.
 * - Stale hit (entry expired): the stale value is returned immediately and
 *   a single background refresh is kicked off (coalesced the same way).
 *   If that refresh fails, the stale value keeps being served and a
 *   warning is logged — accepted tradeoff: stale data can be served
 *   indefinitely while refreshes keep failing, which is fine for
 *   read-mostly UI collections.
 */
export async function getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);

  if (entry && entry.expiresAt > now) {
    return entry.value as T;
  }

  if (entry) {
    // Stale-while-revalidate: serve the stale value now, refresh in the background.
    if (!inFlight.has(key)) {
      coalescedBuild(key, factory)
        .then((value) => {
          store.set(key, { value, expiresAt: Date.now() + ttlMs });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`[collections/cache] background refresh failed for "${key}": ${message}`);
        });
    }
    return entry.value as T;
  }

  const value = await coalescedBuild(key, factory);
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Test-only: clear all cached entries so tests don't leak state across runs. */
export function clearCache(): void {
  store.clear();
  inFlight.clear();
}
