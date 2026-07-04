/**
 * Minimal per-process in-memory cache for the Collections endpoints.
 *
 * There is no shared cache table/layer for collections yet — this is a
 * process-local `Map` with a TTL per key. It is intentionally simple:
 * no eviction beyond lazy expiry-on-read, no cross-process invalidation.
 * Good enough for the read-mostly, short-TTL collections endpoints.
 */

interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Return the cached value for `key` if still fresh; otherwise compute it via
 * `factory`, cache it for `ttlMs`, and return it.
 */
export async function getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.value as T;
  }
  const value = await factory();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Test-only: clear all cached entries so tests don't leak state across runs. */
export function clearCache(): void {
  store.clear();
}
