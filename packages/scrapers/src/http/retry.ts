import type { HtmlFetcher } from './html-fetcher.js';

/**
 * Retry policy for HTML fetches. Only TRANSIENT failures are retried:
 *
 *  - HTTP 429 (rate limited)
 *  - request timeout — our `FetchHtmlFetcher` aborts via AbortController, which
 *    surfaces as an `AbortError` (and, at the socket layer, `ETIMEDOUT`)
 *  - connection resets — `ECONNRESET` / `ECONNABORTED`
 *
 * Deliberately NOT retried: HTTP 404/410 and other 4xx (the page is gone or
 * forbidden — retrying just wastes budget), and parse failures (those happen
 * after the fetch, outside this helper). A non-retryable error is rethrown on
 * the first attempt so the caller records it and moves on.
 */

/** Pull an OS/undici error code from an error or its `cause` chain. */
function extractErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string') return e.code;
  if (typeof e.cause === 'object' && e.cause !== null) {
    const cause = e.cause as { code?: unknown };
    if (typeof cause.code === 'string') return cause.code;
  }
  return undefined;
}

/** True when a fetch error is transient and worth retrying. */
export function isRetryableFetchError(err: unknown): boolean {
  // Per-request timeout: AbortController.abort() → AbortError.
  if (err instanceof Error && err.name === 'AbortError') return true;

  const code = extractErrorCode(err);
  if (code === 'ECONNRESET' || code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;

  const message = err instanceof Error ? err.message : String(err);
  if (/\bHTTP 429\b/.test(message)) return true;
  if (/\b(ECONNRESET|ECONNABORTED|ETIMEDOUT)\b/.test(message)) return true;
  if (/\b(timed out|timeout|aborted)\b/i.test(message)) return true;

  return false;
}

/** Diagnostic payload handed to `onRetry` before each backoff sleep. */
export interface RetryInfo {
  readonly url: string;
  /** 1-based retry number (the first retry is attempt 1). */
  readonly attempt: number;
  readonly delayMs: number;
  readonly error: unknown;
}

export interface FetchWithRetryOptions {
  /** Max retries AFTER the initial attempt. `0` disables retrying. */
  readonly maxRetries: number;
  /** Backoff base: the nth retry waits `baseDelayMs * 2**(n-1)`, capped at `maxDelayMs`. */
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  /** Injectable for deterministic tests. Defaults to a real `setTimeout` sleep. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Injectable classifier; defaults to {@link isRetryableFetchError}. */
  readonly isRetryable?: (err: unknown) => boolean;
  readonly onRetry?: (info: RetryInfo) => void;
}

export interface FetchWithRetryResult {
  readonly html: string;
  /** Total attempts made, including the first (so `attempts - 1` = retries used). */
  readonly attempts: number;
}

/**
 * Fetch `url` with exponential-backoff retries for transient failures. Each
 * attempt is a fresh `fetcher.fetch(url, timeoutMs)` call, so every attempt gets
 * its own AbortController/timeout — a hung attempt cannot outlive `timeoutMs`.
 */
export async function fetchWithRetry(
  fetcher: HtmlFetcher,
  url: string,
  timeoutMs: number,
  options: FetchWithRetryOptions,
): Promise<FetchWithRetryResult> {
  const isRetryable = options.isRetryable ?? isRetryableFetchError;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let attempt = 0;
  for (;;) {
    try {
      const html = await fetcher.fetch(url, timeoutMs);
      return { html, attempts: attempt + 1 };
    } catch (err) {
      if (attempt >= options.maxRetries || !isRetryable(err)) throw err;
      const delayMs = Math.min(options.baseDelayMs * 2 ** attempt, options.maxDelayMs);
      attempt++;
      options.onRetry?.({ url, attempt, delayMs, error: err });
      await sleep(delayMs);
    }
  }
}
