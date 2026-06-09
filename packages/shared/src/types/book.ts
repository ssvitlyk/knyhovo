import type { CanonicalBookId } from './ids.js';

/**
 * ISBN-13 or ISBN-10 as a plain string (e.g. '9786177933105').
 * null when a provider does not supply an ISBN for the given listing.
 */
export type ISBN = string | null;

/**
 * Minimal shared attributes that describe a book regardless of provider or
 * canonical status. Used as a base for more specific types.
 */
export interface Book {
  readonly title: string;
  readonly author: string;
  readonly isbn: ISBN;
}

/**
 * The single, deduplicated record for a book in the system.
 * Multiple ProviderListings from different providers resolve to one CanonicalBook
 * via the canonical matching pipeline.
 */
export interface CanonicalBook {
  readonly id: CanonicalBookId;
  readonly title: string;
  readonly author: string;
  /** null when no provider has supplied an ISBN for this book. */
  readonly isbn: ISBN;
  /** ISO 8601 timestamp of when this canonical record was first created. */
  readonly createdAt: string;
}
