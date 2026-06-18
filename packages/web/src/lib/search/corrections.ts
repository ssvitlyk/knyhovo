import { normalizeQuery } from './normalize';

/** A pair of original and corrected query strings. */
export interface Correction {
  readonly original: string;
  readonly corrected: string;
}

/**
 * Curated static dictionary of known top typos → corrected display query (W7a, no fuzzy).
 *
 * Keys MUST be `normalizeQuery()` outputs (lowercased, collapsed, apostrophes normalized).
 * Values are the display-cased corrected queries shown to the user.
 */
export const CORRECTION_DICTIONARY: Readonly<Record<string, string>> = {
  'гари потер': 'Гаррі Поттер',
  'гарі потер': 'Гаррі Поттер',
  'гаррі потер': 'Гаррі Поттер',
  'сапиенс': 'Sapiens',
  'сапієнс': 'Sapiens',
  'атомні звичкі': 'Атомні звички',
  'кафка на пляжи': 'Кафка на пляжі',
  'сергий жадан': 'Сергій Жадан',
};

/**
 * Exact lookup against the static dictionary.
 *
 * Normalizes the input via `normalizeQuery`, then looks it up as an exact key.
 * Returns a {@link Correction} only when the corrected value (after normalizing) differs
 * from the normalized input — preventing identity "corrections".
 * Returns `null` for unknown or already-correct queries. No fuzzy matching.
 */
export function lookupCorrection(query: string): Correction | null {
  const normalized = normalizeQuery(query);
  const corrected = CORRECTION_DICTIONARY[normalized];

  if (corrected === undefined) {
    return null;
  }

  // Guard: skip if the corrected form normalizes to the same string (no-op correction).
  if (normalizeQuery(corrected) === normalized) {
    return null;
  }

  return { original: query.trim(), corrected };
}
