'use client';

import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/format';
import type { MoneyDto } from '@/lib/api/types';

/** DOM id of the best-price block the sticky bar tracks (set in OffersPanel). */
const BEST_BLOCK_ID = 'bd-best-block';

export interface StickyCtaProps {
  readonly price: MoneyDto;
  readonly store: string;
  readonly href: string;
}

/**
 * StickyCta — mobile-only sticky purchase bar (frozen Book Details v1.1).
 * Appears after the best-price block scrolls out of view (IntersectionObserver)
 * and hides once it is visible again. Desktop visibility is suppressed via CSS
 * (`.bdm-sticky` shows only under the <768px breakpoint). Rendered by OffersPanel
 * only when offers exist, so it is absent in the unavailable state.
 */
export function StickyCta({ price, store, href }: StickyCtaProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(BEST_BLOCK_ID);
    if (target === null || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show only once the best-price block has scrolled ABOVE the viewport
        // (its top passes the top edge) — not while it is still below the fold,
        // so the bar never appears before the user reaches the price section.
        if (entry === undefined) return;
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="bdm-sticky"
      data-visible={visible ? 'true' : 'false'}
      role="region"
      aria-label="Купити книгу — найкраща ціна"
    >
      <div className="bdm-sticky__deal">
        <span className="bdm-sticky__price">{formatMoney(price)}</span>
        <span className="bdm-sticky__store">
          {'найкраща ціна · '}
          {store}
        </span>
      </div>
      <a className="kn-btn kn-btn--primary" href={href} target="_blank" rel="noopener noreferrer">
        Перейти до книгарні
      </a>
    </div>
  );
}
