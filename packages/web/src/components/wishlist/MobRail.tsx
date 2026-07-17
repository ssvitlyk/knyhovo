'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, providerDisplayName } from '@/lib/format';
import type { WishlistOpportunityItem } from '@/lib/wishlist/opportunities';
import { DynIcon } from '@/components/collections/icons';
import { reasonMeta } from './reason-meta';
import { AdaptiveBuyCta } from './AdaptiveBuyCta';

interface MobCardProps {
  readonly item: WishlistOpportunityItem;
}

/** Mobile carousel card — port of `WL22MobCard`. */
function MobCard({ item }: MobCardProps): React.JSX.Element {
  const router = useRouter();
  const meta = reasonMeta(item.reason);
  const oldPrice = item.prevPrice != null && item.prevPrice > item.price ? item.prevPrice : null;
  const disc = oldPrice != null ? Math.round((1 - item.price / oldPrice) * 100) : 0;
  const detailsHref = `/books/${item.bookId}`;

  const openDetails = (e: React.SyntheticEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('a, button')) return;
    router.push(detailsHref);
  };

  return (
    <article
      className="wl22-mob"
      role="link"
      tabIndex={0}
      aria-label={`Деталі книги: ${item.title}`}
      onClick={openDetails}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetails(e);
        }
      }}
    >
      <span className="wl22-chev" aria-hidden="true">
        <DynIcon name="chevron-right" size={16} />
      </span>
      <div className="wl22-mob__badgerow">
        <span className="wl21-badge wl21-badge--green">
          <DynIcon name={meta.icon} size={12} />
          {meta.label}
        </span>
      </div>
      <div className="wl22-mob__left">
        <div className="wl21-featm__book wl22-mob__book">
          {item.coverUrl != null ? <img src={item.coverUrl} alt="" draggable={false} /> : null}
        </div>
      </div>
      <div className="wl22-mob__body">
        <div className="wl22-mob__head">
          <h3 className="wl22-mob__title">{item.title}</h3>
          <p className="wl22-mob__author">{item.author}</p>
        </div>
        <div className="wl22-mob__rule" aria-hidden="true" />
        <span className="wl21-featm__store wl22-mob__store">{providerDisplayName(item.store)}</span>
        {/* The slot always renders (CSS reserves its height) so price/store/CTA
            sit at identical positions across cards with and without a discount. */}
        <div className="wl21-featm__priceline wl22-mob__priceline">
          {oldPrice != null ? (
            <>
              <s className="wl21-featm__old">
                {formatMoney({ amount: oldPrice, currency: item.currency })}
              </s>
              <span className="wl21-featm__disc">−{disc}%</span>
            </>
          ) : null}
        </div>
        <AdaptiveBuyCta
          price={item.price}
          currency={item.currency}
          href={item.ctaUrl}
          className="wl21-featm__buy wl22-mob__buy"
        />
      </div>
    </article>
  );
}

interface DotsProps {
  readonly count: number;
  readonly active: number;
}

/** Minimal, non-competing pagination dots — port of `WL22Dots`. */
function Dots({ count, active }: DotsProps): React.JSX.Element | null {
  if (count < 2) return null;
  return (
    <div className="wl22-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`wl22-dot${i === active ? ' wl22-dot--on' : ''}`} />
      ))}
    </div>
  );
}

export interface MobRailProps {
  readonly items: readonly WishlistOpportunityItem[];
}

/**
 * Mobile 1-at-a-time swipe carousel — verbatim port of `WL22Rail`'s pointer-
 * drag physics (frozen, `incoming/CLAUDE.md`): track-based (only the track
 * animates, cards never reorder/remount), 5px axis-lock, 0.35 rubber-band past
 * the edges, velocity flick (>0.4px/ms past 6px) advances a page, a plain drag
 * needs `min(80px, 20% of step)`, post-drag click squelch (60ms), ←/→ moves
 * focus+page, `touch-action: pan-y`. Exactly one item → solo card, no rail/dots.
 */
export function MobRail({ items }: MobRailProps): React.JSX.Element {
  const N = items.length;
  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [pagerIdx, setPagerIdx] = useState(0);

  useEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!view || !track || N < 2) return undefined;

    const GAP = 12;
    const PEEK = 16;
    const EDGE = 20;
    const DUR = 340;
    const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cells = Array.from(track.children) as HTMLElement[];
    const st = { index: 0, x: 0, cardW: 0, step: 0, Tmin: 0, Tmax: EDGE, w: 0, timer: 0 };

    const measure = (): void => {
      const Vf = view.clientWidth;
      st.w = Vf;
      st.cardW = Math.max(180, Math.round(Vf - 2 * (GAP + PEEK)));
      st.step = st.cardW + GAP;
      cells.forEach((c) => {
        c.style.flexBasis = `${st.cardW}px`;
      });
      st.Tmax = EDGE;
      const trackW = N * st.cardW + (N - 1) * GAP;
      st.Tmin = Math.min(st.Tmax, Vf - EDGE - trackW);
    };
    const restT = (i: number): number => {
      const center = (st.w - st.cardW) / 2;
      return Math.max(st.Tmin, Math.min(st.Tmax, center - i * st.step));
    };
    const apply = (x: number, animate: boolean): void => {
      st.x = x;
      track.style.transition = animate && !reduce ? `transform ${DUR}ms ${EASE}` : 'none';
      track.style.transform = `translate3d(${x}px, 0, 0)`;
    };
    const a11y = (): void => {
      cells.forEach((c, i) => {
        c.setAttribute('aria-hidden', i === st.index ? 'false' : 'true');
        const card = c.firstElementChild as HTMLElement | null;
        if (card) card.tabIndex = i === st.index ? 0 : -1;
      });
    };
    const commit = (i: number, animate: boolean): void => {
      st.index = Math.max(0, Math.min(N - 1, i));
      apply(restT(st.index), animate);
      a11y();
      clearTimeout(st.timer);
      if (animate && !reduce) st.timer = window.setTimeout(() => setPagerIdx(st.index), DUR);
      else setPagerIdx(st.index);
    };

    measure();
    commit(0, false);

    const curX = (): number => {
      try {
        return new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
      } catch {
        return st.x;
      }
    };

    let down = false;
    let decided = false;
    let ok = false;
    let pid: number | null = null;
    let sx = 0;
    let sy = 0;
    let startX = 0;
    let samples: { t: number; x: number }[] = [];

    const onDown = (e: PointerEvent): void => {
      down = true;
      decided = false;
      ok = false;
      pid = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      samples = [{ t: e.timeStamp, x: e.clientX }];
    };
    const onMove = (e: PointerEvent): void => {
      if (!down) return;
      const dxRaw = e.clientX - sx;
      const dyRaw = e.clientY - sy;
      if (!decided) {
        if (Math.abs(dxRaw) < 5 && Math.abs(dyRaw) < 5) return;
        decided = true;
        ok = Math.abs(dxRaw) > Math.abs(dyRaw);
        if (!ok) return;
        try {
          if (pid != null) view.setPointerCapture(pid);
        } catch {
          // ignore
        }
        startX = curX();
        apply(startX, false);
        sx = e.clientX;
        sy = e.clientY;
        samples = [{ t: e.timeStamp, x: e.clientX }];
      }
      if (!ok) return;
      e.preventDefault();
      const dx = e.clientX - sx;
      samples.push({ t: e.timeStamp, x: e.clientX });
      while (samples.length > 1 && e.timeStamp - samples[0].t > 120) samples.shift();
      let raw = startX + dx;
      if (raw > st.Tmax) raw = st.Tmax + (raw - st.Tmax) * 0.35;
      else if (raw < st.Tmin) raw = st.Tmin + (raw - st.Tmin) * 0.35;
      apply(raw, false);
    };
    const squelch = (e: Event): void => {
      e.stopPropagation();
      e.preventDefault();
    };
    const onUp = (e: PointerEvent): void => {
      if (!down) return;
      down = false;
      if (!ok) return;
      view.addEventListener('click', squelch, true);
      setTimeout(() => view.removeEventListener('click', squelch, true), 60);
      const dx = e.clientX - sx;
      const s0 = samples[0] ?? { t: e.timeStamp, x: e.clientX };
      const dt = e.timeStamp - s0.t;
      const v = dt > 0 ? (e.clientX - s0.x) / dt : 0;
      const flick = Math.abs(v) > 0.4 && Math.abs(dx) > 6;
      const passed = Math.abs(dx) > Math.min(80, st.step * 0.2);
      let dir = 0;
      if (flick) dir = v < 0 ? 1 : -1;
      else if (passed) dir = dx < 0 ? 1 : -1;
      commit(st.index + dir, true);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      commit(st.index + (e.key === 'ArrowRight' ? 1 : -1), true);
      const card = cells[st.index]?.firstElementChild as HTMLElement | null;
      if (card && view.contains(document.activeElement)) card.focus({ preventScroll: true });
    };

    view.addEventListener('pointerdown', onDown);
    view.addEventListener('pointermove', onMove, { passive: false });
    view.addEventListener('pointerup', onUp);
    view.addEventListener('pointercancel', onUp);
    view.addEventListener('keydown', onKey);

    let rt = 0;
    const onResize = (): void => {
      clearTimeout(rt);
      rt = window.setTimeout(() => {
        measure();
        apply(restT(st.index), false);
      }, 120);
    };
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(st.timer);
      clearTimeout(rt);
      view.removeEventListener('pointerdown', onDown);
      view.removeEventListener('pointermove', onMove);
      view.removeEventListener('pointerup', onUp);
      view.removeEventListener('pointercancel', onUp);
      view.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verbatim port of the reference dependency list
  }, [N, items.map((i) => i.bookId).join(',')]);

  if (N === 1) {
    return (
      <div className="wl22-solo">
        <MobCard item={items[0]} />
      </div>
    );
  }

  return (
    <div>
      <div className="wl22-railwrap" ref={viewRef}>
        <div
          className="wl22-track"
          ref={trackRef}
          role="group"
          aria-roledescription="карусель"
          aria-label="Книги зі знижками"
        >
          {items.map((item) => (
            <div className="wl22-cell" key={item.bookId}>
              <MobCard item={item} />
            </div>
          ))}
        </div>
      </div>
      <Dots count={N} active={pagerIdx} />
      <span className="wl22-sr" role="status">
        {`Книга ${pagerIdx + 1} з ${N}: ${items[pagerIdx].title}`}
      </span>
    </div>
  );
}
