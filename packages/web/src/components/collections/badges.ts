import type { CollectionBookDto } from '@/lib/api/types';
import type { CardBadge } from './CollectionBookCard';

/** Which single badge kind a shelf wants computed for each of its cards. */
export type BadgeKind = 'best-price' | 'discount' | 'new' | 'trending' | 'wishlist-count' | 'none';

const NEW_ARRIVAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Ukrainian compact number formatting, e.g. 1284 → "1,3к". */
function compactUA(n: number): string {
  if (n < 1000) return String(n);
  const t = n / 1000;
  const rounded = Number.isInteger(t) ? String(t) : t.toFixed(1).replace('.', ',');
  return `${rounded}к`;
}

function isNewArrival(book: CollectionBookDto, now: number): boolean {
  const addedAt = new Date(book.catalogAddedAt).getTime();
  return now - addedAt <= NEW_ARRIVAL_WINDOW_MS;
}

/**
 * Mirrors the frozen `badgeFor` per-section logic in collections-app.jsx —
 * one honest, backend-owned signal per card, max one badge. `isBestPrice`
 * flags the single best-price card in a discounts-style shelf (only ever
 * true for one card); shelves that don't track that pass `false`.
 */
export function badgeFor(
  book: CollectionBookDto,
  kind: BadgeKind,
  options: { readonly isBestPrice?: boolean; readonly now?: number } = {},
): CardBadge | null {
  const now = options.now ?? Date.now();

  if (options.isBestPrice) {
    return { tone: 'green', text: 'Найкраща ціна' };
  }

  switch (kind) {
    case 'discount':
      // Solid tone to match the Homepage discount badge (`solid:-N%`).
      return book.discountPercent != null && book.discountPercent > 0
        ? { tone: 'solid', text: `−${book.discountPercent}%` }
        : null;
    case 'new':
      return isNewArrival(book, now) ? { tone: 'accent', text: 'Новинка' } : null;
    case 'trending':
      return { tone: 'accent', icon: 'trending-up', text: 'В тренді' };
    case 'wishlist-count':
      return book.wishlistCount > 0
        ? { tone: 'rose', icon: 'heart', text: compactUA(book.wishlistCount) }
        : null;
    case 'best-price':
    case 'none':
    default:
      return null;
  }
}

/** The id of the book with the single largest real discount in a list, if any. */
export function bestPriceIdOf(books: readonly CollectionBookDto[]): string | undefined {
  let best: CollectionBookDto | undefined;
  for (const b of books) {
    if (b.discountPercent == null) continue;
    if (!best || (best.discountPercent ?? 0) < b.discountPercent) best = b;
  }
  return best?.id;
}
