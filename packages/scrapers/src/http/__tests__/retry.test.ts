import { describe, it, expect, vi } from 'vitest';
import { fetchWithRetry, isRetryableFetchError } from '../retry.js';
import type { HtmlFetcher } from '../html-fetcher.js';

const noSleep = async (): Promise<void> => {};

/** Fetcher whose successive calls return/throw the given queued outcomes. */
function scriptedFetcher(outcomes: Array<string | (() => never)>): HtmlFetcher {
  let i = 0;
  return {
    fetch: vi.fn(async () => {
      const outcome = outcomes[Math.min(i, outcomes.length - 1)];
      i++;
      if (typeof outcome === 'function') return outcome();
      return outcome;
    }),
  };
}

function httpError(status: number, statusText = ''): Error {
  return new Error(`HTTP ${status} ${statusText}`.trim());
}

function abortError(): Error {
  const err = new Error('This operation was aborted');
  err.name = 'AbortError';
  return err;
}

function codeError(code: string): Error {
  // undici surfaces socket errors as `TypeError: fetch failed` with a `cause.code`.
  const err = new TypeError('fetch failed') as Error & { cause?: unknown };
  err.cause = { code };
  return err;
}

describe('isRetryableFetchError', () => {
  it('retries HTTP 429', () => {
    expect(isRetryableFetchError(httpError(429, 'Too Many Requests'))).toBe(true);
  });

  it('retries request timeouts (AbortError)', () => {
    expect(isRetryableFetchError(abortError())).toBe(true);
  });

  it('retries connection resets (ECONNRESET / ECONNABORTED via cause.code)', () => {
    expect(isRetryableFetchError(codeError('ECONNRESET'))).toBe(true);
    expect(isRetryableFetchError(codeError('ECONNABORTED'))).toBe(true);
    expect(isRetryableFetchError(codeError('ETIMEDOUT'))).toBe(true);
  });

  it('does NOT retry HTTP 404 / 410 / 403', () => {
    expect(isRetryableFetchError(httpError(404, 'Not Found'))).toBe(false);
    expect(isRetryableFetchError(httpError(410, 'Gone'))).toBe(false);
    expect(isRetryableFetchError(httpError(403, 'Forbidden'))).toBe(false);
  });

  it('does NOT retry an arbitrary parse-style error', () => {
    expect(isRetryableFetchError(new Error('malformed JSON-LD'))).toBe(false);
  });
});

describe('fetchWithRetry', () => {
  it('returns immediately on first success (1 attempt, no retries)', async () => {
    const fetcher = scriptedFetcher(['<html>ok</html>']);
    const result = await fetchWithRetry(fetcher, 'u', 100, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
      sleep: noSleep,
    });
    expect(result).toEqual({ html: '<html>ok</html>', attempts: 1 });
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a transient 429 then succeeds', async () => {
    const fetcher = scriptedFetcher([
      () => {
        throw httpError(429, 'Too Many Requests');
      },
      '<html>ok</html>',
    ]);
    const onRetry = vi.fn();
    const result = await fetchWithRetry(fetcher, 'u', 100, {
      maxRetries: 3,
      baseDelayMs: 1,
      maxDelayMs: 10,
      sleep: noSleep,
      onRetry,
    });
    expect(result.html).toBe('<html>ok</html>');
    expect(result.attempts).toBe(2);
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('gives up after maxRetries on a persistent transient error', async () => {
    const fetcher = scriptedFetcher([
      () => {
        throw httpError(429, 'Too Many Requests');
      },
    ]);
    await expect(
      fetchWithRetry(fetcher, 'u', 100, {
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 10,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/HTTP 429/);
    // initial attempt + 2 retries = 3
    expect(fetcher.fetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry a non-retryable 404 (throws on first attempt)', async () => {
    const fetcher = scriptedFetcher([
      () => {
        throw httpError(404, 'Not Found');
      },
    ]);
    await expect(
      fetchWithRetry(fetcher, 'u', 100, {
        maxRetries: 5,
        baseDelayMs: 1,
        maxDelayMs: 10,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/HTTP 404/);
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff capped at maxDelayMs', async () => {
    const fetcher = scriptedFetcher([
      () => {
        throw httpError(429);
      },
    ]);
    const delays: number[] = [];
    await expect(
      fetchWithRetry(fetcher, 'u', 100, {
        maxRetries: 4,
        baseDelayMs: 100,
        maxDelayMs: 400,
        sleep: async (ms) => {
          delays.push(ms);
        },
      }),
    ).rejects.toThrow();
    // 100, 200, 400, then capped at 400
    expect(delays).toEqual([100, 200, 400, 400]);
  });
});
