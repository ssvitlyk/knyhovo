import type { Provider, Availability, PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefreshTargetScope {
  readonly inWishlist: boolean;
  readonly hasActiveAlert: boolean;
}

export interface RefreshTarget {
  readonly provider: Provider;
  readonly providerListingId: string;
  readonly canonicalBookId: string;
  readonly url: string;
  readonly currentPriceAmount: number;
  readonly currentPriceCurrency: 'UAH';
  readonly currentAvailability: Availability;
  readonly lastSeenAt: Date;
  readonly scope: RefreshTargetScope;
}

/**
 * A candidate listing tagged with the scope it was discovered through. The same
 * listing may appear more than once (via wishlist AND via active alert); the
 * selector dedups and merges scope flags.
 */
export interface ScopedCandidateListing {
  readonly provider: Provider;
  readonly providerListingId: string;
  readonly canonicalBookId: string;
  readonly url: string | null;
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: Availability;
  readonly lastSeenAt: Date;
  readonly origin: 'wishlist' | 'alert';
}

// ---------------------------------------------------------------------------
// Pure selector
// ---------------------------------------------------------------------------

/**
 * Deduplicate and select refresh targets from a list of scoped candidates.
 *
 * - Candidates with a null or blank url are excluded.
 * - When the same providerListingId appears via multiple origins, they are
 *   merged into one target with the union of scope flags.
 * - Result is sorted stably: provider → canonicalBookId → providerListingId.
 */
export function selectRefreshTargets(candidates: readonly ScopedCandidateListing[]): RefreshTarget[] {
  // Dedup by providerListingId, merging scope flags.
  const map = new Map<
    string,
    {
      candidate: ScopedCandidateListing;
      inWishlist: boolean;
      hasActiveAlert: boolean;
    }
  >();

  for (const c of candidates) {
    // Skip listings without a usable URL.
    if (c.url == null || c.url.trim() === '') continue;

    const existing = map.get(c.providerListingId);
    if (existing == null) {
      map.set(c.providerListingId, {
        candidate: c,
        inWishlist: c.origin === 'wishlist',
        hasActiveAlert: c.origin === 'alert',
      });
    } else {
      // Merge scope flags; keep first-seen values for price/availability.
      existing.inWishlist = existing.inWishlist || c.origin === 'wishlist';
      existing.hasActiveAlert = existing.hasActiveAlert || c.origin === 'alert';
    }
  }

  // Build targets and sort deterministically.
  const targets: RefreshTarget[] = Array.from(map.values()).map(
    ({ candidate, inWishlist, hasActiveAlert }) => ({
      provider: candidate.provider,
      providerListingId: candidate.providerListingId,
      canonicalBookId: candidate.canonicalBookId,
      url: candidate.url as string, // null/blank already filtered above
      currentPriceAmount: candidate.priceAmount,
      currentPriceCurrency: candidate.priceCurrency,
      currentAvailability: candidate.availability,
      lastSeenAt: candidate.lastSeenAt,
      scope: { inWishlist, hasActiveAlert },
    }),
  );

  targets.sort((a, b) => {
    if (a.provider < b.provider) return -1;
    if (a.provider > b.provider) return 1;
    if (a.canonicalBookId < b.canonicalBookId) return -1;
    if (a.canonicalBookId > b.canonicalBookId) return 1;
    if (a.providerListingId < b.providerListingId) return -1;
    if (a.providerListingId > b.providerListingId) return 1;
    return 0;
  });

  return targets;
}

// ---------------------------------------------------------------------------
// Repository — provider-agnostic (no provider-specific branching)
// ---------------------------------------------------------------------------

/**
 * Load all provider listings that belong to at least one wishlisted book.
 * Emits ScopedCandidateListing entries:
 *   - always one with origin 'wishlist'
 *   - additionally one with origin 'alert' when any wishlist item has an ACTIVE alert
 *
 * Deduplication and scope merging happen in selectRefreshTargets, which keeps
 * all business logic in a single pure function.
 */
export async function findRefreshTargetCandidates(
  prisma: PrismaClient,
): Promise<ScopedCandidateListing[]> {
  const rows = await prisma.providerListing.findMany({
    where: {
      canonicalBook: {
        wishlistItems: { some: {} },
      },
    },
    select: {
      id: true,
      provider: true,
      canonicalBookId: true,
      url: true,
      priceAmount: true,
      priceCurrency: true,
      availability: true,
      lastSeenAt: true,
      canonicalBook: {
        select: {
          wishlistItems: {
            select: {
              alert: {
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });

  const candidates: ScopedCandidateListing[] = [];

  for (const row of rows) {
    const base = {
      provider: row.provider,
      providerListingId: row.id,
      canonicalBookId: row.canonicalBookId,
      url: row.url,
      priceAmount: row.priceAmount,
      // The DB returns Currency enum 'UAH'; assert the narrower literal type.
      priceCurrency: row.priceCurrency as 'UAH',
      availability: row.availability,
      lastSeenAt: row.lastSeenAt,
    };

    // Always emit a wishlist-origin entry.
    candidates.push({ ...base, origin: 'wishlist' });

    // Emit an alert-origin entry when any wishlist item has an ACTIVE alert.
    const hasActiveAlert = row.canonicalBook.wishlistItems.some(
      (item) => item.alert?.status === 'ACTIVE',
    );
    if (hasActiveAlert) {
      candidates.push({ ...base, origin: 'alert' });
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

/** Load candidates from DB and select refresh targets in one call. */
export async function collectRefreshTargets(prisma: PrismaClient): Promise<RefreshTarget[]> {
  return selectRefreshTargets(await findRefreshTargetCandidates(prisma));
}
