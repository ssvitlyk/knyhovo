import type { ProviderName } from '@knyhovo/shared';

/**
 * Discovery metadata-selection (book-metadata PRD).
 *
 * Deterministic, pure display-metadata selection for Book Details. A canonical
 * book may carry several provider listings, each with its own (possibly null)
 * publisher/language/format/series/publicationYear; this picks exactly one
 * value per field to display.
 *
 * Mirrors the provider-priority + price-tiebreak rule of
 * description-selection.ts / cover-selection.ts, but is intentionally
 * standalone — it neither imports nor alters either of them. Each field is
 * selected independently, so a book can show e.g. its publisher from Yakaboo
 * and its series from Vivat if that is where each field was first found.
 */

/**
 * Fixed provider priority for display-metadata selection (book-metadata PRD).
 * Lower index wins. Providers absent from this list sort last.
 * Same order as cover/description selection so all three stay consistent.
 */
export const METADATA_PROVIDER_PRIORITY: readonly ProviderName[] = ['yakaboo', 'vivat', 'book-ye'];

/** A single listing's contribution to metadata selection. */
export interface MetadataCandidate {
  readonly provider: ProviderName;
  /**
   * Price in the smallest currency unit (kopecks). Optional deterministic
   * tiebreak (ascending) between candidates of the same provider; candidates
   * without a price sort last within their provider.
   */
  readonly priceAmount?: number | null;
  readonly publisher?: string | null;
  readonly language?: string | null;
  readonly format?: string | null;
  readonly series?: string | null;
  readonly publicationYear?: number | null;
}

/** Selected display metadata — one value per field, independently sourced. */
export interface SelectedMetadata {
  readonly publisher: string | null;
  readonly language: string | null;
  readonly format: string | null;
  readonly series: string | null;
  readonly publicationYear: number | null;
}

function priorityIndex(provider: ProviderName): number {
  const index = METADATA_PROVIDER_PRIORITY.indexOf(provider);
  return index === -1 ? METADATA_PROVIDER_PRIORITY.length : index;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function hasYear(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function priceOrLast(amount: number | null | undefined): number {
  return typeof amount === 'number' && Number.isFinite(amount)
    ? amount
    : Number.POSITIVE_INFINITY;
}

/** Sort candidates by provider priority, then ascending price — the shared ordering. */
function orderCandidates(
  candidates: readonly MetadataCandidate[],
): readonly MetadataCandidate[] {
  return [...candidates].sort((a, b) => {
    const byPriority = priorityIndex(a.provider) - priorityIndex(b.provider);
    if (byPriority !== 0) return byPriority;
    return priceOrLast(a.priceAmount) - priceOrLast(b.priceAmount);
  });
}

/**
 * Select the display edition metadata from a set of listing candidates.
 *
 * Rule (deterministic — no random, no time dependency), applied independently
 * per field:
 *   1. sort candidates by provider priority (yakaboo → vivat → book-ye), then
 *      by ascending price as a stable tiebreak;
 *   2. return the first candidate that carries a usable value for that field;
 *   3. return null for a field when no candidate has a usable value.
 *
 * Book Details passes ALL listings (in-stock and out-of-stock alike).
 */
export function selectBookMetadata(candidates: readonly MetadataCandidate[]): SelectedMetadata {
  const ordered = orderCandidates(candidates);

  const publisher = ordered.find((c) => hasText(c.publisher))?.publisher?.trim() ?? null;
  const language = ordered.find((c) => hasText(c.language))?.language?.trim() ?? null;
  const format = ordered.find((c) => hasText(c.format))?.format?.trim() ?? null;
  const series = ordered.find((c) => hasText(c.series))?.series?.trim() ?? null;
  const publicationYear = ordered.find((c) => hasYear(c.publicationYear))?.publicationYear ?? null;

  return { publisher, language, format, series, publicationYear };
}
