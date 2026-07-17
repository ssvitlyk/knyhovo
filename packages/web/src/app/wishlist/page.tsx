import { cookies } from 'next/headers';
import { getWishlist, getBuyingOpportunities } from '@/lib/api/wishlist';
import { getBookDetails } from '@/lib/api/book';
import { getPriceHistoryServer } from '@/lib/api/priceHistory';
import type { BookDetailsDto, BuyingOpportunityDto, WishlistItemDto, BookPriceHistoryDto } from '@/lib/api/types';
import { splitWishlist } from '@/lib/wishlist/opportunities';
import { KNYHOVYK_PICK } from '@/lib/knyhovyk-pick';
import {
  alertTargetAmount,
  deriveKnyhovykStatus,
  type KnyhovykOpportunitySignal,
  type KnyhovykStatus,
} from '@/lib/knyhovyk-status';
import { providerDisplayName } from '@/lib/format';
import { WishlistAuthRequired } from '@/components/wishlist/WishlistAuthRequired';
import { WishlistEmpty } from '@/components/wishlist/WishlistEmpty';
import { WishlistHero } from '@/components/wishlist/WishlistHero';
import { KnyhovykPick } from '@/components/wishlist/KnyhovykPick';
import { BuyingOpportunities } from '@/components/wishlist/BuyingOpportunities';
import { RestOfWishlist } from '@/components/wishlist/RestOfWishlist';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

interface PickData {
  readonly bookId: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string | null;
  readonly status: KnyhovykStatus;
  readonly price: number;
  readonly prevPrice: number | null;
  readonly targetPrice: number | null;
  readonly currency: string;
  readonly storeDisplayName: string;
  readonly ctaHref: string;
  readonly note?: string;
}

/**
 * Derive the «Порада Книговика» props from the curated pick's book details +
 * price history, or `null` when the section should be hidden: no curator pick
 * (product decision №4), the book-details fetch failed, or the book has no
 * in-stock offer (never feature an unavailable book).
 */
function buildKnyhovykPick(
  items: readonly WishlistItemDto[],
  opportunities: readonly BuyingOpportunityDto[],
  pickDetails: BookDetailsDto | null,
  pickHistory: BookPriceHistoryDto | null,
): PickData | null {
  if (KNYHOVYK_PICK == null || pickDetails == null) return null;
  const pick = KNYHOVYK_PICK;

  const inStockOffers = pickDetails.providers
    .filter((p) => p.availability === 'in-stock')
    .slice()
    .sort((a, b) => a.price.amount - b.price.amount);
  const bestOffer = inStockOffers[0];
  if (bestOffer == null) return null;

  const points = pickHistory?.points ?? [];
  const prevAmount = points.length >= 2 ? points[points.length - 2].amount : null;
  const allTimeMinAmount = pickHistory?.lowest?.amount ?? null;

  const now = Date.now();
  const min90Candidates = points
    .slice(0, -1)
    .filter((p) => now - new Date(p.recordedAt).getTime() <= NINETY_DAYS_MS);
  const min90Amount =
    min90Candidates.length > 0 ? Math.min(...min90Candidates.map((p) => p.amount)) : null;

  const wishlistItem = items.find((i) => i.book.id === pick.bookId);
  const targetAmount = alertTargetAmount(wishlistItem?.alert);

  const opportunitySignals: KnyhovykOpportunitySignal[] = opportunities.map((o) => ({
    bookId: o.bookId,
    price: o.price,
    prevPrice: o.prevPrice,
    savingsAmount: o.savingsAmount,
  }));

  const status = deriveKnyhovykStatus({
    bookId: pick.bookId,
    currentAmount: bestOffer.price.amount,
    prevAmount,
    allTimeMinAmount,
    min90Amount,
    targetAmount,
    opportunities: opportunitySignals,
  });

  return {
    bookId: pick.bookId,
    title: pickDetails.title,
    author: pickDetails.author,
    coverUrl: pickDetails.coverUrl,
    status,
    price: bestOffer.price.amount,
    prevPrice: prevAmount,
    targetPrice: targetAmount,
    currency: bestOffer.price.currency,
    storeDisplayName: providerDisplayName(bestOffer.provider),
    ctaHref: bestOffer.url,
    note: pick.note,
  };
}

/**
 * Wishlist v2.2 page (Server Component) — Hero → «Порада Книговика»? →
 * «Зараз вигідно купити» → «Решта бажанок»?, per the frozen page order.
 * Fetches wishlist + buying-opportunities (+ the curated pick's book details
 * and price history, when configured) in parallel.
 */
export default async function WishlistPage(): Promise<React.JSX.Element> {
  const cookie = (await cookies()).toString();

  const [wishlistResult, opportunitiesResult, pickDetails, pickHistory] = await Promise.all([
    getWishlist({ cookie }),
    getBuyingOpportunities({ cookie }),
    KNYHOVYK_PICK != null ? getBookDetails(KNYHOVYK_PICK.bookId).catch(() => null) : Promise.resolve(null),
    KNYHOVYK_PICK != null
      ? getPriceHistoryServer(KNYHOVYK_PICK.bookId, 'all').catch(() => null)
      : Promise.resolve(null),
  ]);

  if ('unauthorized' in wishlistResult || 'unauthorized' in opportunitiesResult) {
    return (
      <main className="wishlist">
        <WishlistAuthRequired />
      </main>
    );
  }

  const { items } = wishlistResult;

  if (items.length === 0) {
    return (
      <main className="wishlist">
        <WishlistEmpty />
      </main>
    );
  }

  const { opportunities, rest } = splitWishlist(items, opportunitiesResult.items);

  // M, the KPI sum and its currency all come from the same joined set, so a
  // defensively-dropped opportunity can never skew «M із N» vs the savings.
  const totalSavings = opportunities.reduce((sum, opp) => sum + opp.savingsAmount, 0);
  const currency =
    opportunities[0]?.currency ??
    items.find((i) => i.book.lowestPrice != null)?.book.lowestPrice?.currency ??
    'UAH';

  const pick = buildKnyhovykPick(items, opportunitiesResult.items, pickDetails, pickHistory);

  return (
    <main className="wishlist">
      <WishlistHero
        totalWishlistCount={opportunitiesResult.totalWishlistCount}
        opportunitiesCount={opportunities.length}
        totalSavings={totalSavings}
        currency={currency}
      />
      {pick != null ? <KnyhovykPick {...pick} /> : null}
      {/* Owner decision (2026-07-17, supersedes the frozen `.wl21-saleempty`
          empty state at page level): with zero opportunities the whole band is
          removed — the page keeps only Hero + «Решта бажанок». The component
          retains its empty-state branch as the frozen recipe. */}
      {opportunities.length > 0 ? <BuyingOpportunities items={opportunities} /> : null}
      {rest.length > 0 ? <RestOfWishlist items={rest} /> : null}
    </main>
  );
}
