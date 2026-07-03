'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatMoney } from '@/lib/format';
import { addToWishlist, removeFromWishlist, WishlistError } from '@/lib/api/wishlist';
import { useLoginModal } from '@/components/auth/LoginModalProvider';
import { BookCard } from '@/components/ds/BookCard';
import { Badge, type BadgeTone as DsBadgeTone } from '@/components/ds/Badge';
import { CollectionIcon } from './icons';
import type { CollectionBookDto } from '@/lib/api/types';

/** Collection badge tones: DS tones + a Collections-only `rose` (wishlist count). */
export type BadgeTone = 'accent' | 'green' | 'solid' | 'rose';

export interface CardBadge {
  readonly tone: BadgeTone;
  readonly icon?: string;
  readonly text: string;
}

/** Map a collection badge tone to a DS <Badge> tone (rose falls back to accent
 *  + the .kn-badge--rose colour override, so the DS component stays untouched). */
function dsTone(tone: BadgeTone): DsBadgeTone {
  return tone === 'rose' ? 'accent' : tone;
}

export interface CollectionBookCardProps {
  readonly book: CollectionBookDto;
  readonly badge?: CardBadge | null;
  /** Path the current page lives at, used as returnTo for the login modal. */
  readonly returnTo?: string;
}

/**
 * Collections book card — composes the SAME DS `<BookCard>` used by the
 * Homepage shelves (design/badge/price 1:1 with Homepage), so every book card
 * in the app is visually consistent. The one deliberate difference: Homepage
 * shows the store name in the price row; here that slot is replaced by an
 * always-visible quick-wishlist heart (top-right corner), unchanged from the
 * existing behaviour (optimistic toggle, 401 → login modal, no navigation).
 * The whole card opens Book Details.
 */
export function CollectionBookCard({ book, badge = null, returnTo }: CollectionBookCardProps): React.JSX.Element {
  const [saved, setSaved] = useState(book.isWishlisted);
  const [pending, setPending] = useState(false);
  const [pop, setPop] = useState(false);
  const { openLogin } = useLoginModal();

  async function toggle(e: React.MouseEvent): Promise<void> {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);

    const nextSaved = !saved;
    setSaved(nextSaved); // optimistic

    try {
      if (nextSaved) {
        await addToWishlist(book.id);
        setPop(true);
        setTimeout(() => setPop(false), 300);
      } else {
        await removeFromWishlist(book.id);
      }
    } catch (error) {
      setSaved(!nextSaved); // revert
      if (error instanceof WishlistError && error.status === 401) {
        openLogin(returnTo ?? null);
      }
    } finally {
      setPending(false);
    }
  }

  const badgeNode = badge ? (
    <Badge tone={dsTone(badge.tone)} className={badge.tone === 'rose' ? 'kn-badge--rose' : undefined}>
      {badge.icon ? <CollectionIcon name={badge.icon} size={12} /> : null}
      {badge.text}
    </Badge>
  ) : null;

  return (
    <Link href={`/books/${book.id}`} className="cl-card">
      <BookCard
        className="cl-book"
        title={book.title}
        author={book.author}
        price={book.minPrice ? formatMoney(book.minPrice) : '—'}
        oldPrice={book.oldPrice ? formatMoney(book.oldPrice) : null}
        cover={book.coverUrl}
        badge={badgeNode}
      />
      <button
        type="button"
        className={'cl-card__wish' + (saved ? ' cl-card__wish--on' : '') + (pop ? ' cl-card__wish--pop' : '')}
        onClick={(e) => void toggle(e)}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? 'У бажанках' : 'Додати в бажанки'}
        title={saved ? 'У бажанках' : 'Додати в бажанки'}
      >
        <CollectionIcon name="heart" size={18} fill={saved ? 'currentColor' : 'none'} />
      </button>
    </Link>
  );
}
