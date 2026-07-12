/**
 * Category-key normalization (genres-taxonomy PRD §5.3).
 *
 * `normalizeCategoryKey` is applied when LOOKING UP a raw provider category in
 * the mapping index (`mapping-engine.ts`) and when validating/upserting
 * `mappings.seed.ts` rows. It is deliberately NOT applied when persisting
 * `provider_listings.raw_categories` — stored signals stay provider-native
 * (trim/collapse only, done in `pipeline/persist-listing.ts`), so mapping
 * rules can be fixed and re-run later without a re-scrape.
 */

/**
 * Normalize a raw provider category into a stable mapping-index key.
 *
 * Pipeline (PRD §5.3, in order): NFC → trim → collapse whitespace →
 * lowercase → strip a trailing item counter («Фентезі (123)») → strip framing
 * slashes. Idempotent: `normalizeCategoryKey(normalizeCategoryKey(x)) ===
 * normalizeCategoryKey(x)`.
 */
export function normalizeCategoryKey(raw: string): string {
  let key = raw.normalize('NFC');
  key = key.trim().replace(/\s+/g, ' ');
  key = key.toLowerCase();
  key = key.replace(/\s*\(\d+\)$/u, '');
  key = key.replace(/^\/+|\/+$/g, '');
  return key.trim();
}

/**
 * Iterate a root→leaf breadcrumb path leaf-first (PRD §5.3). Returns a new
 * array; the input is never mutated. Used by the mapping engine to pick the
 * deepest mapped element of a breadcrumb path.
 */
export function leafFirst<T>(path: readonly T[]): readonly T[] {
  return [...path].reverse();
}
