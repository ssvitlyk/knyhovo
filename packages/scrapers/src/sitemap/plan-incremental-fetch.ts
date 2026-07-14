import type { SitemapEntry } from '@knyhovo/shared';

/** Result of diffing sitemap entries against a known-watermark map. */
export interface IncrementalFetchPlan {
  /** Entries that must be fetched: new, changed, or carrying no lastmod signal. */
  readonly toFetch: SitemapEntry[];
  /** Count of entries skipped because their lastmod did not advance past the known watermark. */
  readonly unchangedCount: number;
}

/**
 * Pure diff between sitemap entries and a per-URL watermark map. Fails open in
 * every ambiguous case — an entry is only ever skipped when there is a known,
 * parseable watermark that the entry's lastmod did not advance past:
 *   - `known` undefined → full mode, everything goes to `toFetch`.
 *   - URL absent from `known` → new URL, `toFetch`.
 *   - `entry.lastmod` null → no signal, `toFetch`.
 *   - known watermark unparseable as a date → `toFetch`.
 *   - `entry.lastmod` strictly newer than the known watermark (compared as
 *     `Date` milliseconds) → `toFetch`.
 *   - otherwise → unchanged, skipped.
 */
export function planIncrementalFetch(
  entries: ReadonlyArray<SitemapEntry>,
  known: ReadonlyMap<string, string> | undefined,
): IncrementalFetchPlan {
  if (known === undefined) {
    return { toFetch: [...entries], unchangedCount: 0 };
  }

  const toFetch: SitemapEntry[] = [];
  let unchangedCount = 0;

  for (const entry of entries) {
    const knownLastmod = known.get(entry.url);

    if (knownLastmod === undefined || entry.lastmod === null) {
      toFetch.push(entry);
      continue;
    }

    const knownMs = new Date(knownLastmod).getTime();
    if (Number.isNaN(knownMs)) {
      toFetch.push(entry);
      continue;
    }

    const entryMs = new Date(entry.lastmod).getTime();
    if (entryMs > knownMs) {
      toFetch.push(entry);
    } else {
      unchangedCount++;
    }
  }

  return { toFetch, unchangedCount };
}
