'use client';

import { useState } from 'react';
import type { WishlistOpportunityItem } from '@/lib/wishlist/opportunities';
import { DynIcon } from '@/components/collections/icons';
import { useIsDesktop } from './useIsDesktop';
import { SaleCard } from './SaleCard';
import { MobRail } from './MobRail';

const PER = 4;

/**
 * Desktop peek geometry — port of `trackX` in `WL21Discounts`: 91%-wide steps,
 * first page flush left, last page flush right, middle pages nudged so a
 * sliver of both neighbors peeks.
 */
function trackX(i: number, total: number): number {
  if (total <= 1) return 0;
  const base = -(i * 91);
  if (i === 0) return base;
  if (i === total - 1) return base + 12;
  return base + 6;
}

export interface BuyingOpportunitiesProps {
  readonly items: readonly WishlistOpportunityItem[];
}

/**
 * «Зараз вигідно купити» section (Client island) — port of `WL21Discounts`.
 * Desktop: 2×2 paged carousel (`PER = 4` per page), edge fades, progress bar +
 * serif «cur / total» counter, header prev/next arrows (desktop-only, hidden
 * when there's only one page). Mobile: `MobRail` 1-at-a-time swipe carousel.
 * Zero items → `.wl21-saleempty` frozen copy instead of any carousel chrome.
 * The frontend never re-sorts `items` — order is authoritative from the API.
 */
export function BuyingOpportunities({ items }: BuyingOpportunitiesProps): React.JSX.Element {
  const isDesktop = useIsDesktop();

  const pages: WishlistOpportunityItem[][] = [];
  for (let i = 0; i < items.length; i += PER) pages.push(items.slice(i, i + PER));
  const total = pages.length;

  const [page, setPage] = useState(0);
  const cur = Math.min(page, Math.max(0, total - 1));
  const hasPrev = cur > 0;
  const hasNext = cur < total - 1;

  return (
    <div className="band band--green" data-screen-label="Зараз вигідно купити">
      {/* No inner .page: the root layout already wraps routes in the padded
          .page container; the prototype's own .page maps onto that one. */}
      <div className="sec-head">
          <div className="sec-head__left">
            <span className="sec-eyebrow">Ваші бажанки · момент настав</span>
            <h2 className="sec-title">Зараз вигідно купити</h2>
            <p className="sec-sub">
              Книги з ваших бажанок, які зараз можна придбати найвигідніше.
            </p>
          </div>
          {isDesktop && total > 1 ? (
            <div className="wl21-caro__nav">
              <button
                type="button"
                className="wl21-caro__arrow"
                aria-label="Попередні книги"
                disabled={!hasPrev}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <DynIcon name="chevron-left" size={20} />
              </button>
              <button
                type="button"
                className="wl21-caro__arrow"
                aria-label="Наступні книги"
                disabled={!hasNext}
                onClick={() => setPage((p) => Math.min(total - 1, p + 1))}
              >
                <DynIcon name="chevron-right" size={20} />
              </button>
            </div>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="wl21-saleempty reveal">
            <span className="wl21-saleempty__icon">
              <DynIcon name="search" size={22} />
            </span>
            <p className="wl21-saleempty__title">Сьогодні вигідних пропозицій ще немає.</p>
            <p className="wl21-saleempty__sub">
              Книговик стежить за цінами і повідомить, щойно з&apos;явиться щось цікаве.
            </p>
          </div>
        ) : isDesktop ? (
          <div className="wl21-caro reveal">
            <div className="wl21-caro__viewport">
              <div
                className="wl21-caro__track"
                style={{ transform: `translateX(${trackX(cur, total)}%)` }}
              >
                {pages.map((chunk, ci) => (
                  <div className="wl21-caro__page" key={ci} aria-hidden={ci !== cur}>
                    {chunk.map((item) => (
                      <SaleCard item={item} key={item.bookId} />
                    ))}
                  </div>
                ))}
              </div>
              <div className={`wl21-caro__fade wl21-caro__fade--left${hasPrev ? ' is-on' : ''}`} />
              <div className={`wl21-caro__fade wl21-caro__fade--right${hasNext ? ' is-on' : ''}`} />
            </div>
            {total > 1 ? (
              <div className="wl21-caro__progress">
                <div className="wl21-caro__bar">
                  <span style={{ width: `${((cur + 1) / total) * 100}%` }} />
                </div>
                <span className="wl21-caro__count">
                  {cur + 1} / {total}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="reveal">
            <MobRail items={items} />
          </div>
        )}
    </div>
  );
}
