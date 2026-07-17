import type { PrismaClient } from '@prisma/client';
import { findWishlistItemsForBuyingOpportunities } from './repository.js';
import { evaluateBuyingOpportunities } from './engine.js';
import type { BuyingOpportunitiesResponseDto } from './dto.js';

/** Dependency injection interface for clock-dependent operations. */
export interface BuyingOpportunitiesDeps {
  now(): Date;
}

/**
 * Fetch the user's wishlist and evaluate it through the buying-reason engine.
 *
 * `totalWishlistCount` counts every wishlist row (qualifying or not) — it is
 * NOT `items.length`.
 */
export async function getBuyingOpportunities(
  prisma: PrismaClient,
  userId: string,
  deps: BuyingOpportunitiesDeps,
): Promise<BuyingOpportunitiesResponseDto> {
  const rows = await findWishlistItemsForBuyingOpportunities(prisma, userId);
  const items = evaluateBuyingOpportunities(rows, deps.now());

  return { items, totalWishlistCount: rows.length };
}
