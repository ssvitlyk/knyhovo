'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { removeFromWishlist, WishlistError } from '@/lib/api/wishlist';

export interface RemoveButtonProps {
  readonly bookId: string;
}

/**
 * Icon button that removes a book from the wishlist. Optimistically disables
 * itself during the request and calls `router.refresh()` on success so the
 * Server Component re-fetches the list. On error the item is kept (no
 * destructive UX on failure).
 */
export function RemoveButton({ bookId }: RemoveButtonProps): React.JSX.Element {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick(): Promise<void> {
    if (pending) return;
    setPending(true);
    try {
      await removeFromWishlist(bookId);
      router.refresh();
    } catch (error) {
      // Keep the item in the list — do not show a destructive error state.
      if (!(error instanceof WishlistError)) throw error;
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="wl-iconbtn"
      aria-label="Прибрати з бажанок"
      title="Прибрати з бажанок"
      disabled={pending}
      onClick={() => void handleClick()}
    >
      <X size={16} aria-hidden />
    </button>
  );
}
