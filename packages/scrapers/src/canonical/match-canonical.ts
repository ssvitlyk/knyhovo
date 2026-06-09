import type { RawProviderListing, CanonicalBook } from '@knyhovo/shared';
import type { CanonicalBookId } from '@knyhovo/shared';
import type { MatchResult, ConflictReason } from './types.js';
import { normalizeTitle, normalizeAuthor } from './normalize.js';
import { normalizeIsbn } from './isbn.js';
import { titleSimilarity, authorSimilarity } from './similarity.js';
import { extractVolumeNumber, isBundle } from './conflicts.js';

const TITLE_THRESHOLD = 0.85;
const AUTHOR_THRESHOLD = 0.80;
const FINAL_THRESHOLD = 0.85;
const TITLE_NO_AUTHOR_THRESHOLD = 0.92;
const AUTHOR_PENALTY = 0.80;

// Higher value = higher priority when multiple conflict reasons are observed
const CONFLICT_PRIORITY: Record<ConflictReason, number> = {
  ISBN_CONFLICT: 3,
  VOLUME_MISMATCH: 2,
  BUNDLE_MISMATCH: 1,
};

export function matchOrCreate(
  listing: RawProviderListing,
  candidates: CanonicalBook[],
): MatchResult {
  const normIsbn = normalizeIsbn(listing.isbn);
  const normTitle = normalizeTitle(listing.title);
  const normAuthor = normalizeAuthor(listing.author ?? '');
  const listingVolume = extractVolumeNumber(listing.title);
  const listingBundle = isBundle(listing.title);

  let seenConflict: ConflictReason | null = null;
  const isbnBlockedIds = new Set<CanonicalBookId>();

  function recordConflict(reason: ConflictReason): void {
    if (
      seenConflict === null ||
      CONFLICT_PRIORITY[reason] > CONFLICT_PRIORITY[seenConflict]
    ) {
      seenConflict = reason;
    }
  }

  // ── Step 1: ISBN exact match + ISBN conflict detection ───────────────
  if (normIsbn !== null) {
    for (const candidate of candidates) {
      const candIsbn = normalizeIsbn(candidate.isbn);
      if (candIsbn === null) continue;

      if (candIsbn === normIsbn) {
        return { type: 'matched', canonicalBookId: candidate.id };
      }

      // Both have ISBNs but they differ — possible bad data or different editions
      recordConflict('ISBN_CONFLICT');
      isbnBlockedIds.add(candidate.id);
    }
  }

  // ── Steps 2–3: Exact key + Fuzzy (skip ISBN-conflicted candidates) ───
  let bestCandidate: CanonicalBookId | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (isbnBlockedIds.has(candidate.id)) continue;

    const candVolume = extractVolumeNumber(candidate.title);
    const candBundle = isBundle(candidate.title);

    // Hard conflict: differing explicit volumes
    if (listingVolume !== null && candVolume !== null && listingVolume !== candVolume) {
      recordConflict('VOLUME_MISMATCH');
      continue;
    }

    // Hard conflict: bundle vs single
    if (listingBundle !== candBundle) {
      recordConflict('BUNDLE_MISMATCH');
      continue;
    }

    const candNormTitle = normalizeTitle(candidate.title);
    const candNormAuthor = normalizeAuthor(candidate.author);

    // ── Step 2: Exact normalized key match ───────────────────────────
    if (normTitle === candNormTitle && normAuthor === candNormAuthor) {
      return { type: 'matched', canonicalBookId: candidate.id };
    }

    // ── Step 3: Fuzzy ────────────────────────────────────────────────
    const tSim = titleSimilarity(normTitle, candNormTitle);
    if (tSim < TITLE_THRESHOLD) continue;

    let aSim: number;
    const hasListingAuthor = listing.author !== null && listing.author.trim().length > 0;
    const hasCandAuthor = candidate.author.trim().length > 0;

    if (!hasListingAuthor || !hasCandAuthor) {
      if (tSim >= TITLE_NO_AUTHOR_THRESHOLD) {
        aSim = AUTHOR_PENALTY;
      } else {
        continue;
      }
    } else {
      aSim = authorSimilarity(normAuthor, candNormAuthor);
      if (aSim < AUTHOR_THRESHOLD) continue;
    }

    const score = tSim * 0.65 + aSim * 0.35;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate.id;
    }
  }

  // ── Step 4: Decision ─────────────────────────────────────────────────
  if (bestCandidate !== null && bestScore >= FINAL_THRESHOLD) {
    return { type: 'matched', canonicalBookId: bestCandidate };
  }

  if (seenConflict !== null) {
    return { type: 'conflict', reason: seenConflict };
  }

  return { type: 'created' };
}
