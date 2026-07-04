'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { addToWishlist, removeFromWishlist, WishlistError } from '@/lib/api/wishlist';
import { useLoginModal } from '@/components/auth/LoginModalProvider';

export interface WishlistHearts {
  readonly saved: ReadonlySet<string>;
  readonly toggle: (bookId: string) => void;
}

/**
 * Quick-wishlist state for the collections card hearts (`.bkc__wish`).
 * Optimistic toggle backed by the real wishlist API; a 401 reverts the heart
 * and opens the app-wide login modal with the current path as returnTo.
 * Hearts start unsaved — the collections contract carries no per-user
 * wishlist status. TODO: hydrate initial saved state once the API exposes it.
 */
export function useWishlistHearts(): WishlistHearts {
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
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
