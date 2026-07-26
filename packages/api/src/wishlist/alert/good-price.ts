/**
 * The «Вигідна ціна» threshold source.
 *
 * notifications-model-v2 §5 fixes the product definition and the requirements a
 * formula must satisfy, and deliberately does NOT fix the formula: the recorded
 * price history is event-driven (a row appears only when price or availability
 * changed), so neither the observation density nor the real price distribution on
 * our catalogue is known yet. The calibration is a separate data study —
 * docs/research/good-price-threshold-study.md.
 *
 * Until that study lands this module answers `unavailable` for every book, which
 * is exactly the honest state the PRD asks for: the mode is offered as
 * «Збираємо історію цін» and never as a number. Because the resolver stores the
 * result as a plain threshold plus a basis and a proof string (§5.4), filling the
 * formula in later is a change to this file alone — the engine, the API, the DTOs
 * and the UI stay as they are.
 */

/** A resolved good-price threshold, ready to be frozen into a policy. */
export interface GoodPriceSuggestion {
  /** Threshold amount in kopiyky. */
  readonly amount: number;
  /** Which formula produced it — persisted as `thresholdBasis`. */
  readonly basis: string;
  /** One-line human proof — persisted as `thresholdProof`. */
  readonly proof: string;
}

export type GoodPriceResult =
  | { readonly available: true; readonly suggestion: GoodPriceSuggestion }
  | { readonly available: false; readonly reason: 'PENDING_CALIBRATION' | 'INSUFFICIENT_HISTORY' };

/** The observations a formula will need, so callers already gather the right data. */
export interface PriceHistorySample {
  /** Recorded price points (kopiyky) inside the evaluation window, any order. */
  readonly amounts: readonly number[];
  /** The book's canonical price right now, or null when nothing is in stock. */
  readonly canonicalPrice: number | null;
}

/**
 * Resolve the good-price threshold for a book.
 *
 * Returns `available: false` with `PENDING_CALIBRATION` while the formula is
 * undecided. It never falls back to the canonical price: restating today's price
 * as "вигідна" is the exact defect this model removes — it made the mode
 * indistinguishable from «будь-яке зниження» and fired the moment it was saved.
 */
export function resolveGoodPrice(sample: PriceHistorySample): GoodPriceResult {
  // The sample is deliberately unused: no formula is approved yet (PRD §5.3), and
  // guessing one here is exactly what this model set out to stop. Reading it keeps
  // the seam honest — a caller that forgets to gather history will not silently
  // "work" once the formula lands.
  void sample.amounts.length;
  return { available: false, reason: 'PENDING_CALIBRATION' };
}
