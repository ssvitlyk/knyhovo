import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOrSet, clearCache } from '../cache.js';

/** A promise you can resolve/reject from outside, for controllable factories. */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flush the microtask queue enough times for chained .then/.finally/await hops to settle. */
async function flushMicrotasks(times = 10): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe('collections cache', () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the cached value on a fresh hit without calling the factory again', async () => {
    const factory = vi.fn().mockResolvedValue('value-1');

    const first = await getOrSet('key-a', 60_000, factory);
    const second = await getOrSet('key-a', 60_000, factory);

    expect(first).toBe('value-1');
    expect(second).toBe('value-1');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('coalesces N concurrent calls for the same key on a cold cache into a single factory call', async () => {
    const d = deferred<string>();
    const factory = vi.fn().mockReturnValue(d.promise);

    const calls = Array.from({ length: 5 }, () => getOrSet('key-b', 60_000, factory));

    // Give microtasks a chance to run so all callers observe the in-flight build.
    await Promise.resolve();
    await Promise.resolve();

    d.resolve('shared-value');
    const results = await Promise.all(calls);

    expect(results).toEqual(Array(5).fill('shared-value'));
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('rejects all concurrent waiters on a cold-miss factory failure and retries cleanly next time', async () => {
    const d = deferred<string>();
    const failingFactory = vi.fn().mockReturnValue(d.promise);

    const calls = Array.from({ length: 3 }, () => getOrSet('key-c', 60_000, failingFactory));
    await Promise.resolve();
    await Promise.resolve();

    const error = new Error('boom');
    d.reject(error);

    await expect(Promise.all(calls)).rejects.toThrow('boom');
    expect(failingFactory).toHaveBeenCalledTimes(1);

    // Nothing was cached, and the in-flight entry was cleared -> next call retries.
    const retryFactory = vi.fn().mockResolvedValue('recovered');
    const value = await getOrSet('key-c', 60_000, retryFactory);
    expect(value).toBe('recovered');
    expect(retryFactory).toHaveBeenCalledTimes(1);
  });

  it('serves the stale value synchronously on an expired entry and refreshes it in the background', async () => {
    vi.useFakeTimers();

    const firstFactory = vi.fn().mockResolvedValue('initial');
    await getOrSet('key-d', 1_000, firstFactory);

    vi.advanceTimersByTime(1_001);

    const refreshDeferred = deferred<string>();
    const refreshFactory = vi.fn().mockReturnValue(refreshDeferred.promise);

    const staleValue = await getOrSet('key-d', 1_000, refreshFactory);
    expect(staleValue).toBe('initial');
    // The refresh factory result is not awaited before returning stale data.
    expect(refreshFactory).toHaveBeenCalledTimes(1);

    refreshDeferred.resolve('refreshed');
    // Flush microtasks so the background .then() handler runs and updates the store.
    await flushMicrotasks();

    const nextFactory = vi.fn().mockResolvedValue('should-not-be-called');
    const afterRefresh = await getOrSet('key-d', 1_000, nextFactory);
    expect(afterRefresh).toBe('refreshed');
    expect(nextFactory).not.toHaveBeenCalled();
  });

  it('keeps serving the stale value when a background refresh fails, without an unhandled rejection', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const firstFactory = vi.fn().mockResolvedValue('initial');
    await getOrSet('key-e', 1_000, firstFactory);

    vi.advanceTimersByTime(1_001);

    const refreshDeferred = deferred<string>();
    const refreshFactory = vi.fn().mockReturnValue(refreshDeferred.promise);

    const staleValue = await getOrSet('key-e', 1_000, refreshFactory);
    expect(staleValue).toBe('initial');

    refreshDeferred.reject(new Error('refresh failed'));
    await flushMicrotasks();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('key-e');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('refresh failed');

    // Still stale but expired -> another read serves stale again and can retry the refresh.
    const stillStaleFactory = vi.fn().mockResolvedValue('recovered');
    const stillStale = await getOrSet('key-e', 1_000, stillStaleFactory);
    expect(stillStale).toBe('initial');

    warnSpy.mockRestore();
  });

  it('caps concurrent distinct-key factories at 4, running the rest in later waves', async () => {
    let running = 0;
    let maxObservedConcurrency = 0;
    const deferreds = Array.from({ length: 6 }, () => deferred<string>());

    const makeFactory = (i: number) => async () => {
      running += 1;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, running);
      try {
        return await deferreds[i]!.promise;
      } finally {
        running -= 1;
      }
    };

    const calls = Array.from({ length: 6 }, (_, i) => getOrSet(`key-f-${i}`, 60_000, makeFactory(i)));

    // Let all synchronous/microtask work settle so the first wave starts.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(running).toBe(4);
    expect(maxObservedConcurrency).toBeLessThanOrEqual(4);

    // Resolve the first wave; queued factories should then start.
    deferreds[0]!.resolve('v0');
    deferreds[1]!.resolve('v1');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(running).toBeLessThanOrEqual(4);

    // Resolve everything else so all calls settle.
    deferreds[2]!.resolve('v2');
    deferreds[3]!.resolve('v3');
    deferreds[4]!.resolve('v4');
    deferreds[5]!.resolve('v5');

    const results = await Promise.all(calls);
    expect(results).toEqual(['v0', 'v1', 'v2', 'v3', 'v4', 'v5']);
    expect(maxObservedConcurrency).toBeLessThanOrEqual(4);
  });
});
