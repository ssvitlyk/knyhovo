'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { CollectionBookDto } from '@/lib/api/types';
import type { CardBadge } from '@/lib/collections/badges';
import { addToWishlist, removeFromWishlist, WishlistError } from '@/lib/api/wishlist';
import { useLoginModal } from '@/components/auth/LoginModalProvider';

/** A card-grid/shelf item: the card data + its precomputed (serializable) badge. */
export interface BookCardItem {
  readonly book: CollectionBookDto;
  readonly badge: CardBadge | null;
}

export interface WishlistHearts {
  readonly saved: ReadonlySet<string>;
  readonly toggle: (bookId: string) => void;
}

/**
 * Quick-wishlist state for the collections card hearts (`.bkc__wish`).
 * Optimistic toggle backed by the real wishlist API; a 401 reverts the heart
 * and opens the app-wide login modal with the current path as returnTo.
 * Seeded once (on mount) from each item's `book.isWishlisted` (server-decorated
 * per-user; always empty for a guest request).
 */
export function useWishlistHearts(items: readonly BookCardItem[]): WishlistHearts {
  const [saved, setSaved] = useState<ReadonlySet<string>>(
    () => new Set(items.filter(({ book }) => book.isWishlisted).map(({ book }) => book.id)),
  );
  const { openLogin } = useLoginModal();
  const pathname = usePathname();

  const toggle = useCallback(
    (bookId: string) => {
      let willAdd = false;
      setSaved((prev) => {
        const next = new Set(prev);
        willAdd = !next.has(bookId);
        if (willAdd) next.add(bookId);
        else next.delete(bookId);
        return next;
      });

      void (willAdd ? addToWishlist(bookId) : removeFromWishlist(bookId)).catch((error: unknown) => {
        // Revert the optimistic flip.
        setSaved((prev) => {
          const next = new Set(prev);
          if (willAdd) next.delete(bookId);
          else next.add(bookId);
          return next;
        });
        if (error instanceof WishlistError && error.status === 401) openLogin(pathname);
      });
    },
    [openLogin, pathname],
  );

  return { saved, toggle };
}
