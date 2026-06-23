/**
 * Tests for fetcher-registry.ts (W10.6).
 *
 * NOTE: PlaywrightHtmlFetcher(browserManager) can be constructed without launching
 * a browser — the browser only starts on the first `.fetch()` call. So calling
 * resolveTargetFetcher for Playwright-backed providers is safe in tests as long as
 * we never call .fetch() on the returned instance.
 */
import { describe, it, expect } from 'vitest';
import { resolveTargetFetcher } from '../fetcher-registry.js';
import { PlaywrightHtmlFetcher, FetchHtmlFetcher } from '@knyhovo/scrapers';

describe('resolveTargetFetcher — provider routing', () => {
  it('yakaboo → PlaywrightHtmlFetcher', () => {
    const fetcher = resolveTargetFetcher('yakaboo');
    expect(fetcher).toBeInstanceOf(PlaywrightHtmlFetcher);
  });

  it('book-ye → PlaywrightHtmlFetcher', () => {
    const fetcher = resolveTargetFetcher('book-ye');
    expect(fetcher).toBeInstanceOf(PlaywrightHtmlFetcher);
  });

  it('vivat → FetchHtmlFetcher', () => {
    const fetcher = resolveTargetFetcher('vivat');
    expect(fetcher).toBeInstanceOf(FetchHtmlFetcher);
  });

  it('book-club → FetchHtmlFetcher', () => {
    const fetcher = resolveTargetFetcher('book-club');
    expect(fetcher).toBeInstanceOf(FetchHtmlFetcher);
  });
});

describe('resolveTargetFetcher — unknown provider', () => {
  it('throws a descriptive error for a provider not in the registry', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberately testing invalid input
      resolveTargetFetcher('unknown-provider' as any),
    ).toThrow(/no fetcher registered for provider unknown-provider/);
  });
});

describe('resolveTargetFetcher — singleton stability', () => {
  it('two calls for yakaboo return the SAME instance', () => {
    const a = resolveTargetFetcher('yakaboo');
    const b = resolveTargetFetcher('yakaboo');
    expect(a).toBe(b);
  });

  it('two calls for book-ye return the SAME instance', () => {
    const a = resolveTargetFetcher('book-ye');
    const b = resolveTargetFetcher('book-ye');
    expect(a).toBe(b);
  });

  it('two calls for vivat return the SAME instance', () => {
    const a = resolveTargetFetcher('vivat');
    const b = resolveTargetFetcher('vivat');
    expect(a).toBe(b);
  });

  it('two calls for book-club return the SAME instance', () => {
    const a = resolveTargetFetcher('book-club');
    const b = resolveTargetFetcher('book-club');
    expect(a).toBe(b);
  });
});
