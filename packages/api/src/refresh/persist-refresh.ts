/**
 * Persist a re-fetched listing's state back to the database.
 *
 * Provider-agnostic — no provider branching. Keyed by providerListingId.
 * Reuses recordPriceChange from the price-history service (append-only rule).
 */

import type { PrismaClient } from '@prisma/client';
import type { RefreshTarget } from './refresh-targets.js';
import type { RefreshedListingState } from './events.js';
import { recordPriceChange } from '../price-history/service.js';

export interface PersistRefreshInput {
  readonly target: RefreshTarget;
  readonly refreshed: RefreshedListingState;
  readonly now: Date;
}

export type PersistRefreshOutcome =
  | {
      readonly kind: 'price-updated';
      readonly priceHistoryCreated: boolean;
      readonly availabilityChanged: boolean;
    }
  | { readonly kind: 'availability-updated'; readonly priceHistoryCreated: boolean }
  | { readonly kind: 'gone-skipped' }
  | { readonly kind: 'missing-listing' };

/**
 * Persist a refreshed listing's new state.
 *
 * - 'gone' => no DB write (non-destructive).
 * - 'fetched' with priceAmount => update price + availability + lastSeenAt; snapshot if changed.
 * - 'fetched' without priceAmount => update availability + lastSeenAt only; keep existing price.
 *
 * Note: coverUrl / description / title / author / isbn are NOT touched — refresh
 * does not re-fetch those fields.
 */
export async function persistRefreshedListing(
  prisma: PrismaClient,
  input: PersistRefreshInput,
): Promise<PersistRefreshOutcome> {
  const { target, refreshed, now } = input;

  if (refreshed.kind === 'gone') {
    return { kind: 'gone-skipped' };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.providerListing.findUnique({
      where: { id: target.providerListingId },
    });

    if (existing === null) {
      return { kind: 'missing-listing' };
    }

    if (refreshed.priceAmount != null) {
      // Price is known — update price + availability + lastSeenAt.
      await tx.providerListing.update({
        where: { id: existing.id },
        data: {
          priceAmount: refreshed.priceAmount,
          availability: refreshed.availability,
          lastSeenAt: now,
        },
      });

      const { created } = await recordPriceChange(tx as Parameters<typeof recordPriceChange>[0], {
        providerListingId: existing.id,
        previous: {
          priceAmount: existing.priceAmount,
          priceCurrency: existing.priceCurrency,
          availability: existing.availability,
        },
        next: {
          priceAmount: refreshed.priceAmount,
          priceCurrency: existing.priceCurrency,
          availability: refreshed.availability,
        },
        recordedAt: now,
      });

      return {
        kind: 'price-updated',
        priceHistoryCreated: created,
        availabilityChanged: existing.availability !== refreshed.availability,
      };
    } else {
      // No price available — update availability + lastSeenAt; keep existing price.
      await tx.providerListing.update({
        where: { id: existing.id },
        data: {
          availability: refreshed.availability,
          lastSeenAt: now,
        },
      });

      // Record snapshot only when availability changed (shouldCreateSnapshot in service handles this).
      const { created } = await recordPriceChange(tx as Parameters<typeof recordPriceChange>[0], {
        providerListingId: existing.id,
        previous: {
          priceAmount: existing.priceAmount,
          priceCurrency: existing.priceCurrency,
          availability: existing.availability,
        },
        next: {
          priceAmount: existing.priceAmount,
          priceCurrency: existing.priceCurrency,
          availability: refreshed.availability,
        },
        recordedAt: now,
      });

      return { kind: 'availability-updated', priceHistoryCreated: created };
    }
  });
}
