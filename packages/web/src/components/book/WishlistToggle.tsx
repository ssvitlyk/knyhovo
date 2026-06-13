'use client';

import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { addToWishlist, removeFromWishlist, WishlistError } from '@/lib/api/wishlist';

export interface WishlistToggleProps {
  readonly bookId: string;
  readonly initialInWishlist: boolean;
}

/**
 * WishlistToggle — adds or removes the current book from the wishlist.
 * Placed below the best-price CTA in OffersPanel (Book Details v1.1 spec).
 * Optimistic UI with revert on error; 401 surfaces an inline login prompt.
 */
export function WishlistToggle({ bookId, initialInWishlist }: WishlistToggleProps): React.JSX.Element {
  const [saved, setSaved] = useState(initialInWishlist);
  const [pending, setPending] = useState(false);
  const [authNote, setAuthNote] = useState(false);

  async function handleToggle(): Promise<void> {
    if (pending) return;
    setAuthNote(false);
    setPending(true);

    const nextSaved = !saved;
    setSaved(nextSaved); // optimistic

    try {
      if (nextSaved) {
        await addToWishlist(bookId);
      } else {
        await removeFromWishlist(bookId);
      }
    } catch (error) {
      setSaved(!nextSaved); // revert on error
      if (error instanceof WishlistError && error.status === 401) {
        setAuthNote(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wl-toggle">
      <Button
        variant="secondary"
        disabled={pending}
        iconLeft={saved ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
        onClick={() => void handleToggle()}
        style={{ width: '100%' }}
      >
        {saved ? 'У вішлисті' : 'До вішлиста'}
      </Button>
      {authNote && (
        <p className="wl-toggle__note">Увійдіть, щоб зберігати книги</p>
      )}
    </div>
  );
}
