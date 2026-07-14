import { describe, it, expect } from 'vitest';
import type { SitemapEntry } from '@knyhovo/shared';
import { planIncrementalFetch } from '../plan-incremental-fetch.js';

const entry = (url: string, lastmod: string | null): SitemapEntry => ({ url, lastmod });

describe('planIncrementalFetch', () => {
  it('fetches everything when known is undefined (full mode)', () => {
    const entries = [entry('https://x/a', '2026-01-01T00:00:00.000Z'), entry('https://x/b', null)];
    const plan = planIncrementalFetch(entries, undefined);
    expect(plan.toFetch).toEqual(entries);
    expect(plan.unchangedCount).toBe(0);
  });

  it('fetches a URL not present in known (new URL)', () => {
    const entries = [entry('https://x/new', '2026-01-05T00:00:00.000Z')];
    const known = new Map<string, string>();
    const plan = planIncrementalFetch(entries, known);
    expect(plan.toFetch).toEqual(entries);
    expect(plan.unchangedCount).toBe(0);
  });

  it('fetches when the entry lastmod is strictly newer than the known watermark', () => {
    const entries = [entry('https://x/a', '2026-01-10T00:00:00.000Z')];
    const known = new Map([['https://x/a', '2026-01-05T00:00:00.000Z']]);
    const plan = planIncrementalFetch(entries, known);
    expect(plan.toFetch).toEqual(entries);
    expect(plan.unchangedCount).toBe(0);
  });

  it('skips as unchanged when the entry lastmod equals the known watermark', () => {
    const entries = [entry('https://x/a', '2026-01-05T00:00:00.000Z')];
    const known = new Map([['https://x/a', '2026-01-05T00:00:00.000Z']]);
    const plan = planIncrementalFetch(entries, known);
    expect(plan.toFetch).toEqual([]);
    expect(plan.unchangedCount).toBe(1);
  });

  it('skips as unchanged when the entry lastmod is older than the known watermark', () => {
    const entries = [entry('https://x/a', '2026-01-01T00:00:00.000Z')];
    const known = new Map([['https://x/a', '2026-01-05T00:00:00.000Z']]);
    const plan = planIncrementalFetch(entries, known);
    expect(plan.toFetch).toEqual([]);
    expect(plan.unchangedCount).toBe(1);
  });

  it('always fetches when the entry lastmod is null (no signal, fail open)', () => {
    const entries = [entry('https://x/a', null)];
    const known = new Map([['https://x/a', '2026-01-05T00:00:00.000Z']]);
    const plan = planIncrementalFetch(entries, known);
    expect(plan.toFetch).toEqual(entries);
    expect(plan.unchangedCount).toBe(0);
  });

  it('fetches when the known watermark is unparseable as a date (fail open)', () => {
    const entries = [entry('https://x/a', '2026-01-05T00:00:00.000Z')];
    const known = new Map([['https://x/a', 'not-a-date']]);
    const plan = planIncrementalFetch(entries, known);
    expect(plan.toFetch).toEqual(entries);
    expect(plan.unchangedCount).toBe(0);
  });

  it('handles a mixed batch of new/changed/unchanged/null-lastmod entries', () => {
    const entries = [
      entry('https://x/new', '2026-01-05T00:00:00.000Z'),
      entry('https://x/changed', '2026-01-10T00:00:00.000Z'),
      entry('https://x/unchanged', '2026-01-01T00:00:00.000Z'),
      entry('https://x/no-signal', null),
    ];
    const known = new Map([
      ['https://x/changed', '2026-01-05T00:00:00.000Z'],
      ['https://x/unchanged', '2026-01-01T00:00:00.000Z'],
      ['https://x/no-signal', '2026-01-01T00:00:00.000Z'],
    ]);
    const plan = planIncrementalFetch(entries, known);
    expect(plan.toFetch.map((e) => e.url)).toEqual([
      'https://x/new',
      'https://x/changed',
      'https://x/no-signal',
    ]);
    expect(plan.unchangedCount).toBe(1);
  });
});
