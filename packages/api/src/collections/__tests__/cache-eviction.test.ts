import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOrSet, clearCache, setMaxEntries, cacheSize, DEFAULT_MAX_ENTRIES } from '../cache.js';

const TTL = 60_000;

describe('collections cache bound', () => {
  beforeEach(() => {
    clearCache();
  });
  afterEach(() => {
    clearCache();
    vi.useRealTimers();
  });

  it('defaults to a 1000-entry cap', () => {
    expect(DEFAULT_MAX_ENTRIES).toBe(1000);
  });

  it('never stores more than the cap and evicts the oldest entry first', async () => {
    setMaxEntries(3);
    for (const k of ['a', 'b', 'c', 'd']) {
      await getOrSet(k, TTL, async () => k);
    }
    expect(cacheSize()).toBe(3);

    // 'a' was evicted -> factory runs again; 'd' is still cached.
    const factoryA = vi.fn(async () => 'a2');
    expect(await getOrSet('a', TTL, factoryA)).toBe('a2');
    expect(factoryA).toHaveBeenCalledTimes(1);
    const factoryD = vi.fn(async () => 'd2');
    expect(await getOrSet('d', TTL, factoryD)).toBe('d');
    expect(factoryD).not.toHaveBeenCalled();
  });

  it('a fresh hit refreshes recency (LRU), so the untouched entry is evicted', async () => {
    setMaxEntries(2);
    await getOrSet('a', TTL, async () => 'a');
    await getOrSet('b', TTL, async () => 'b');
    await getOrSet('a', TTL, async () => 'unused'); // touch a -> b is now oldest
    await getOrSet('c', TTL, async () => 'c'); // evicts b

    const factoryB = vi.fn(async () => 'b2');
    expect(await getOrSet('b', TTL, factoryB)).toBe('b2');
    expect(factoryB).toHaveBeenCalledTimes(1);
    expect(cacheSize()).toBe(2);
  });

  it('still coalesces concurrent builds under eviction pressure', async () => {
    setMaxEntries(1);
    let resolve!: (v: string) => void;
    const gate = new Promise<string>((r) => {
      resolve = r;
    });
    const factory = vi.fn(() => gate);
    const p1 = getOrSet('k', TTL, factory);
    const p2 = getOrSet('k', TTL, factory);
    resolve('v');
    expect(await Promise.all([p1, p2])).toEqual(['v', 'v']);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('keeps serving stale + refreshing in the background while bounded', async () => {
    vi.useFakeTimers();
    setMaxEntries(2);
    await getOrSet('k', 1000, async () => 'old');
    vi.advanceTimersByTime(2000);
    const refresh = vi.fn(async () => 'new');
    expect(await getOrSet('k', 1000, refresh)).toBe('old');
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await getOrSet('k', 1000, async () => 'unused')).toBe('new');
    expect(cacheSize()).toBe(1);
  });

  it('clearCache restores the default cap', async () => {
    setMaxEntries(1);
    clearCache();
    await getOrSet('x', TTL, async () => 'x');
    await getOrSet('y', TTL, async () => 'y');
    expect(cacheSize()).toBe(2);
  });
});
