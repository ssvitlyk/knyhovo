/**
 * Candidate-adapter (Layer 3 input seam): `CollectionBookRow → FeedCandidate`.
 *
 * This is one of the two distinct Home Builder responsibilities (the other is
 * the response-mapper). It is the *only* place that knows how a persistence row
 * maps to the composer's opaque `providerId` bucket. The composer never sees a
 * row; the response-mapper never sees a provider enum.
 */
import { cheapestListing } from '../collections/mapper.js';
import type { CollectionBookRow } from '../collections/repository.js';
import type { FeedCandidate } from '../feed-composer/index.js';

/** Bucket for a book with no priced (shown) listing — an opaque string to the composer. */
export const UNKNOWN_PROVIDER = 'UNKNOWN';

/**
 * Build a `FeedCandidate` from a canonical book row. `providerId` is the
 * machine-readable provider enum of the cheapest *shown* listing (the same
 * listing that backs `storeName`/`minPrice` in the DTO), or `UNKNOWN` when the
 * book has no priced listing. The public DTO is unchanged — `providerId` lives
 * only on this internal candidate.
 */
export function toFeedCandidate(row: CollectionBookRow): FeedCandidate {
  const cheapest = cheapestListing(row);
  return { id: row.id, providerId: cheapest ? cheapest.provider : UNKNOWN_PROVIDER };
}
