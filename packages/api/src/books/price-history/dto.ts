import type { Availability, AlertMode } from '@knyhovo/shared';
import type { MoneyDto } from '../../wishlist/dto.js';

/**
 * Price History API v1.0 response contract.
 *
 * These DTOs are the *only* shape exposed to the price-history endpoint.
 * No Prisma model type is ever returned — the repository/mapper layers
 * translate persistence rows into these structures.
 *
 * Monetary amounts are expressed in the smallest currency unit (kopiyky),
 * matching the shared `Money` semantics. Formatting is the UI's responsibility.
 */

/** Valid time-window values for the price-history endpoint. */
export type PriceHistoryPeriod = '30d' | '90d' | '1y' | 'all';

/**
 * A single price-history point as returned in the API response.
 * `availability` is the public slug (`in-stock`, `out-of-stock`, `unknown`).
 * `recordedAt` is an ISO 8601 string.
 */
export interface PriceHistoryPointDto {
  readonly amount: number;
  readonly currency: string;
  readonly availability: Availability;
  readonly recordedAt: string;
}

/**
 * An extreme (lowest or highest) price point.
 * Intentionally omits `availability` — extremes are purely monetary.
 */
export interface PriceHistoryExtremeDto {
  readonly amount: number;
  readonly currency: string;
  readonly recordedAt: string;
}

/** The typical price range computed by trimming one min and one max from >=5 points. */
export interface TypicalRangeDto {
  readonly min: number;
  readonly max: number;
  readonly currency: string;
}

/** Absolute and relative price change from first to current point. */
export interface PriceHistoryChangeDto {
  /** Signed kopiyky: positive = price went up, negative = price went down. */
  readonly amount: number;
  /** Rounded percentage. 0 when first.amount <= 0. */
  readonly percent: number;
}

/**
 * Full price-history payload for one `CanonicalBook`.
 *
 * `current`, `lowest`, `highest`, `typicalRange`, and `change` are `null`
 * when there are no history points in the requested period (empty-state).
 */
export interface BookPriceHistoryDto {
  readonly bookId: string;
  readonly period: PriceHistoryPeriod;
  /** Currency of all monetary fields (`'UAH'`). */
  readonly currency: string;
  /** Most recent recorded price point, or `null` (empty-state). */
  readonly current: PriceHistoryPointDto | null;
  /** Point with the lowest recorded amount, or `null` (empty-state). */
  readonly lowest: PriceHistoryExtremeDto | null;
  /** Point with the highest recorded amount, or `null` (empty-state). */
  readonly highest: PriceHistoryExtremeDto | null;
  /** Typical price range (trimmed when >=5 points), or `null` (empty-state). */
  readonly typicalRange: TypicalRangeDto | null;
  /** Change from first to current point, or `null` (empty-state). */
  readonly change: PriceHistoryChangeDto | null;
  /** All price points in the period, ascending by `recordedAt`. */
  readonly points: readonly PriceHistoryPointDto[];
  /**
   * Per-mode alert preview (notifications-model-v2 §10).
   *
   * Lets the configurator render every mode — availability, threshold and proof —
   * without a single client-side calculation, and without a new endpoint: the
   * dialog already fetches this resource at exactly this moment.
   *
   * Computed over a FIXED window, deliberately independent of `period`: the
   * `?period` parameter drives the chart, and must not silently change the advice.
   *
   * It is a preview, not the contract. The authoritative policy is built by the
   * server on `PUT .../alert` and returned in that response.
   */
  readonly alertPolicyPreview: readonly AlertModePreviewDto[];
}

/** One selectable mode as the configurator should render it. */
export interface AlertModePreviewDto {
  readonly mode: AlertMode;
  /** False → the mode must be shown disabled, with `reason` and no threshold. */
  readonly available: boolean;
  /** The threshold the server would freeze, or null (my-price / unavailable). */
  readonly threshold: MoneyDto | null;
  /** One-line human proof of the threshold, or null. */
  readonly proof: string | null;
  /** Why the mode is unavailable; null when it is available. */
  readonly reason: string | null;
}
