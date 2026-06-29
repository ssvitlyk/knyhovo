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

  function recordConflict(reason: ConflictReason): void {
    if (
      seenConflict === null ||
      CONFLICT_PRIORITY[reason] > CONFLICT_PRIORITY[seenConflict]
    ) {
      seenConflict = reason;
    }
  }

  // ── Step 1: ISBN exact match (authoritative) ─────────────────────────
  // A shared ISBN is the strongest signal of the same edition — it wins over
  // everything else, including title/volume differences in formatting.
  if (normIsbn !== null) {
    for (const candidate of candidates) {
      const candIsbn = normalizeIsbn(candidate.isbn);
      if (candIsbn !== null && candIsbn === normIsbn) {
        return { type: 'matched', canonicalBookId: candidate.id };
      }
    }
  }

  // ── Steps 2–3: Exact key + Fuzzy ─────────────────────────────────────
  // Every conflict (ISBN, volume, bundle) is now scoped HERE, *behind* the title
  // similarity gate: a conflict is only raised against a candidate whose title is
  // already similar enough to plausibly be the same book. A genuinely new book
  // with no title-similar candidate must fall through to `created` rather than
  // being dropped — differing volume/bundle markers on unrelated titles are not a
  // conflict, just different books.
  let bestCandidate: CanonicalBookId | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candNormTitle = normalizeTitle(candidate.title);
    const candNormAuthor = normalizeAuthor(candidate.author);

    // Title similarity gate — FIRST. Only title-similar candidates are considered
    // for a match, an ISBN/volume/bundle conflict, or a fuzzy candidate. Titles
    // below the threshold are different books and are ignored entirely.
    const exactKey = normTitle === candNormTitle && normAuthor === candNormAuthor;
    const tSim = exactKey ? 1 : titleSimilarity(normTitle, candNormTitle);
    if (tSim < TITLE_THRESHOLD) continue;

    const candVolume = extractVolumeNumber(candidate.title);
    const candBundle = isBundle(candidate.title);

    // Hard conflict: differing explicit volumes of an otherwise near-identical
    // title (e.g. "…Книга 1" vs "…Книга 2"). normalizeTitle strips the volume
    // marker, so same-series volumes land here with a high tSim; genuinely
    // different books carrying volume markers were already dropped by the gate.
    if (listingVolume !== null && candVolume !== null && listingVolume !== candVolume) {
      recordConflict('VOLUME_MISMATCH');
      continue;
    }

    // Hard conflict: bundle/box-set vs single edition under a near-identical
    // title (e.g. "…(комплект)" vs the single book).
    if (listingBundle !== candBundle) {
      recordConflict('BUNDLE_MISMATCH');
      continue;
    }

    // ISBN conflict — scoped to *near-identical* titles only. When two books
    // share a virtually identical title (tSim ≥ TITLE_NO_AUTHOR_THRESHOLD) yet
    // carry differing ISBNs, they are conflicting editions / bad data, not a new
    // book. Step 1 already returned on an exact ISBN match, so any candidate
    // ISBN seen here necessarily differs. Looser title overlap (0.85–0.92) is
    // left to the fuzzy path so genuinely different books with similar-looking
    // titles are still created rather than dropped.
    const candIsbn = normalizeIsbn(candidate.isbn);
    if (normIsbn !== null && candIsbn !== null && tSim >= TITLE_NO_AUTHOR_THRESHOLD) {
      recordConflict('ISBN_CONFLICT');
      continue;
    }

    // ── Step 2: Exact normalized key match (no ISBN conflict) ────────
    if (exactKey) {
      return { type: 'matched', canonicalBookId: candidate.id };
    }

    // ── Step 3: Fuzzy ────────────────────────────────────────────────
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
