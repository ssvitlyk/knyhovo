/** Metadata indicating that only a subset of stores responded to the search. */
export interface PartialIndexMeta {
  readonly responded: number;
  readonly total: number;
}

/**
 * Progressive-enhancement guard: read optional store-coverage metadata from a search response.
 *
 * The current API does NOT return this field, so this function returns `null` in practice.
 * It is provided for forward-compatibility and never throws on malformed input.
 *
 * Convention: `response.storeCoverage = { responded: number; total: number }`.
 * Returns meta ONLY when some stores are missing (`responded < total`); full coverage → `null`.
 *
 * Validation requirements for a non-null result:
 * - `storeCoverage.responded` and `storeCoverage.total` are finite integers.
 * - `total > 0`.
 * - `0 <= responded < total`.
 */
export function readPartialIndexMeta(response: unknown): PartialIndexMeta | null {
  try {
    if (response === null || typeof response !== 'object' || Array.isArray(response)) {
      return null;
    }

    const coverage = (response as Record<string, unknown>)['storeCoverage'];

    if (coverage === null || typeof coverage !== 'object' || Array.isArray(coverage)) {
      return null;
    }

    const { responded, total } = coverage as Record<string, unknown>;

    if (
      typeof responded !== 'number' ||
      typeof total !== 'number' ||
      !Number.isFinite(responded) ||
      !Number.isFinite(total) ||
      !Number.isInteger(responded) ||
      !Number.isInteger(total) ||
      total <= 0 ||
      responded < 0 ||
      responded >= total
    ) {
      return null;
    }

    return { responded, total };
  } catch {
    return null;
  }
}
