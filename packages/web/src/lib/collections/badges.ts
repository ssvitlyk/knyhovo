import type { CollectionBookDto } from '@/lib/api/types';

/**
 * Badge logic for the Collections book card (`.bkc__badge`). Computed on the
 * frontend from raw card data (frozen rule: the backend only sends
 * minPrice/oldPrice/discountPercent/inStock/catalogAddedAt/wishlistCount).
 * Max ONE badge per card.
 */

export type BadgeTone = 'rose' | 'accent' | 'new' | 'green' | 'neutral';

export interface CardBadge {
  readonly tone: BadgeTone;
  readonly icon?: string;
  readonly text: string;
}

/** Hub shelf keys that carry a badge treatment (frozen §6). */
export type ShelfKind = 'obrane' | 'popular' | 'novynky' | 'znyzhky';

/**
 * Compact Ukrainian count (ported from the frozen `compactUA` in
 * `collections-app.jsx`): 968 → «968», 1284 → «1,3к», 2000 → «2к».
 */
export function compactUA(n: number): string {
  if (n < 1000) return String(n);
  const t = n / 1000;
  return (Number.isInteger(t) ? String(t) : t.toFixed(1).replace('.', ',')) + 'к';
}

/** Discount percent from oldPrice/minPrice, falling back to the API's discountPercent. */
export function discountPercent(book: CollectionBookDto): number | null {
  if (
    book.oldPrice !== null &&
    book.minPrice !== null &&
    book.oldPrice.amount > 0 &&
    book.minPrice.amount < book.oldPrice.amount
  ) {
    return Math.round((1 - book.minPrice.amount / book.oldPrice.amount) * 100);
  }
  if (book.discountPercent !== null && book.discountPercent > 0) return Math.round(book.discountPercent);
  return null;
}

/**
 * Badge for a hub shelf card (frozen §6): obrane → rose save-count,
 * popular → accent «В тренді», novynky → «Новинка», znyzhky → green «−N%»
 * with the FIRST card of the shelf carrying «Найкраща ціна» instead.
 */
export function shelfBadgeFor(
  shelf: ShelfKind,
  book: CollectionBookDto,
  index: number,
): CardBadge | null {
  switch (shelf) {
    case 'obrane':
      return { tone: 'rose', icon: 'heart', text: compactUA(book.wishlistCount) };
    case 'popular':
      return { tone: 'accent', icon: 'trending-up', text: 'В тренді' };
    case 'novynky':
      return { tone: 'new', text: 'Новинка' };
    case 'znyzhky': {
      if (index === 0) return { tone: 'green', text: 'Найкраща ціна' };
      const pct = discountPercent(book);
      return pct !== null ? { tone: 'green', text: `−${pct}%` } : null;
    }
  }
}

const NEW_ARRIVAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Badge for the Collection Details grid card. Priority (frozen §4):
 * green «−N%» → «Новинка» (catalogAddedAt within 30 days) → neutral
 * «Немає в наявності». Never stacks two. `now` is an explicit argument so the
 * logic stays deterministic in tests.
 */
export function detailsBadgeFor(book: CollectionBookDto, now: Date): CardBadge | null {
  const pct = discountPercent(book);
  if (pct !== null) return { tone: 'green', text: `−${pct}%` };

  const addedAt = book.catalogAddedAt !== null ? Date.parse(book.catalogAddedAt) : NaN;
  if (Number.isFinite(addedAt) && now.getTime() - addedAt <= NEW_ARRIVAL_WINDOW_MS) {
    return { tone: 'new', text: 'Новинка' };
  }

  if (!book.inStock) return { tone: 'neutral', text: 'Немає в наявності' };
  return null;
}
