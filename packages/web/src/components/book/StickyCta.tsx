'use client';

import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/format';
import type { MoneyDto } from '@/lib/api/types';

/** DOM id of the best-price block the sticky bar tracks (set in OffersPanel). */
const BEST_BLOCK_ID = 'bd-best-block';
/** Site footer (rendered by the root layout) — the bar tucks away for it. */
const FOOTER_SELECTOR = '.site-footer';

export interface StickyCtaProps {
  readonly price: MoneyDto;
  readonly store: string;
  readonly href: string;
}

/**
 * StickyCta — mobile-only sticky purchase bar (frozen Book Details v1.1).
 * Appears after the best-price block scrolls out of view (IntersectionObserver)
 * and hides once it is visible again — or once the site footer enters the
 * viewport, so the bar never covers it. Desktop visibility is suppressed via CSS
 * (`.bdm-sticky` shows only under the <768px breakpoint). Rendered by OffersPanel
 * only when offers exist, so it is absent in the unavailable state.
 */
export function StickyCta({ price, store, href }: StickyCtaProps): React.JSX.Element {
  const [pastBest, setPastBest] = useState(false);
  const [footerInView, setFooterInView] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observers: IntersectionObserver[] = [];

    const target = document.getElementById(BEST_BLOCK_ID);
    if (target !== null) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          // Show only once the best-price block has scrolled ABOVE the viewport
          // (its top passes the top edge) — not while it is still below the fold,
          // so the bar never appears before the user reaches the price section.
          if (entry === undefined) return;
          setPastBest(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        },
        { threshold: 0 },
      );
      observer.observe(target);
      observers.push(observer);
    }

    // Footer hand-off: the fixed bar would cover the site footer, so it slides
    // back down as soon as any part of the footer enters the viewport.
    const footer = document.querySelector(FOOTER_SELECTOR);
    if (footer !== null) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry === undefined) return;
          setFooterInView(entry.isIntersecting);
        },
        { threshold: 0 },
      );
      observer.observe(footer);
      observers.push(observer);
    }

    return () => {
      for (const observer of observers) observer.disconnect();
    };
  }, []);

  const visible = pastBest && !footerInView;

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
