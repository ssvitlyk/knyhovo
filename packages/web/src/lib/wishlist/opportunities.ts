import type { BuyingReason, ProviderName } from '@knyhovo/shared';
import type { BuyingOpportunityDto, WishlistItemDto } from '../api/types';

/**
 * A buying opportunity enriched with wishlist book display data, for the
 * wishlist v2.2 «Зараз вигідно купити» section. All money fields are integer
 * kopiyky (mirrors {@link BuyingOpportunityDto}).
 */
export interface WishlistOpportunityItem {
  readonly bookId: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string | null;
  readonly reason: BuyingReason;
  readonly savingsAmount: number;
  readonly price: number;
  readonly prevPrice: number | null;
  readonly currency: string;
  readonly store: ProviderName;
  /** Provider listing URL matching `store`, or `/books/:id` when no matching listing is found. */
  readonly ctaUrl: string;
}

export interface SplitWishlistResult {
  readonly opportunities: readonly WishlistOpportunityItem[];
  readonly rest: readonly WishlistItemDto[];
}

/**
 * Join the wishlist's opportunities against the full wishlist, per the wishlist
 * v2.2 buying-reason contract:
 *  - `opportunities` preserves the API's `opps` order (the frontend never
 *    re-sorts); each entry is enriched with the matching wishlist book's
 *    title/author/coverUrl and a CTA URL resolved by provider slug.
 *  - An opportunity whose `bookId` has no matching wishlist item is dropped
 *    (defensive — should not happen given both come from the same backend).
 *  - `rest` is every wishlist item not present in `opportunities` — the
 *    complement, never dropped or duplicated relative to `items`.
 */
export function splitWishlist(
  items: readonly WishlistItemDto[],
  opportunities: readonly BuyingOpportunityDto[],
): SplitWishlistResult {
  const byBookId = new Map(items.map((item) => [item.book.id, item]));
  const matchedBookIds = new Set<string>();

  const enriched: WishlistOpportunityItem[] = [];
  for (const opp of opportunities) {
    const item = byBookId.get(opp.bookId);
    if (item == null) continue;

    matchedBookIds.add(opp.bookId);

    const provider = item.book.providers.find((p) => p.provider === opp.store);
    enriched.push({
      bookId: opp.bookId,
      title: item.book.title,
      author: item.book.author,
      coverUrl: item.book.coverUrl,
      reason: opp.reason,
      savingsAmount: opp.savingsAmount,
      price: opp.price,
      prevPrice: opp.prevPrice,
      currency: opp.currency,
      store: opp.store,
      ctaUrl: provider?.url ?? `/books/${opp.bookId}`,
    });
  }

  const rest = items.filter((item) => !matchedBookIds.has(item.book.id));

  return { opportunities: enriched, rest };
}
