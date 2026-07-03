'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CollectionIcon } from './icons';
import { CollectionBookCard, type CardBadge } from './CollectionBookCard';
import type { CollectionBookDto } from '@/lib/api/types';
import type { BadgeKind } from './badges';
import { badgeFor } from './badges';

/**
 * Wheel + shift-wheel translate to horizontal (releasing to the page at the
 * ends so scroll is never trapped); click-drag pans (mouse only — touch uses
 * native swipe); a post-drag click is swallowed so panning never opens a book.
 * Ported verbatim from the frozen `useRailInteractions` in collections-app.jsx.
 */
function useRailInteractions(ref: React.RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent): void {
      if (!el) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // native horizontal (shift/trackpad)
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return; // let the page scroll
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }

    let down = false;
    let moved = false;
    let startX = 0;
    let startS = 0;
    let lastX = 0;
    let lastT = 0;
    let vx = 0;
    let flingId = 0;

    function onDown(e: PointerEvent): void {
      if (!el) return;
      if (e.pointerType === 'touch') return; // touch = native swipe
      if (e.button !== undefined && e.button !== 0) return;
      cancelAnimationFrame(flingId);
      down = true;
      moved = false;
      startX = e.clientX;
      startS = el.scrollLeft;
      lastX = e.clientX;
      lastT = performance.now();
      vx = 0;
    }
    function onMove(e: PointerEvent): void {
      if (!down || !el) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        el.classList.add('is-dragging');
      }
      if (moved) {
        el.scrollLeft = startS - dx;
        const now = performance.now();
        const dt = now - lastT;
        if (dt > 4) {
          vx = (e.clientX - lastX) / dt;
          lastX = e.clientX;
          lastT = now;
        }
      }
    }
    function onUp(): void {
      if (!down || !el) return;
      down = false;
      if (!moved) return;
      let v = vx * 15;
      function step(): void {
        if (!el) return;
        if (Math.abs(v) < 0.5) {
          el.classList.remove('is-dragging');
          return;
        }
        el.scrollLeft -= v;
        v *= 0.93;
        flingId = requestAnimationFrame(step);
      }
      if (Math.abs(v) > 0.5) {
        flingId = requestAnimationFrame(step);
      } else {
        el.classList.remove('is-dragging');
      }
    }
    function onClickCapture(e: MouseEvent): void {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      cancelAnimationFrame(flingId);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, [ref]);
}

export interface ShelfProps {
  readonly books: readonly CollectionBookDto[];
  readonly badgeKind: BadgeKind;
  /** Id of the single best-price book in this shelf, if any (green «Найкраща ціна»). */
  readonly bestPriceId?: string;
  readonly allLabel?: string;
  readonly allHref: string;
  readonly returnTo?: string;
}

/** Horizontal shelf rail: wheel/drag/swipe, prev/next arrows, trailing "see all" card. */
export function Shelf({ books, badgeKind, bestPriceId, allLabel, allHref, returnTo }: ShelfProps): React.JSX.Element {
  const railRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [nav, setNav] = useState({ left: false, right: true });
  useRailInteractions(railRef);

  const sync = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setNav({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const cover = el.querySelector<HTMLElement>('.kn-book__cover');
    if (cover && wrapRef.current) {
      wrapRef.current.style.setProperty('--cover-mid', `${cover.offsetTop + cover.offsetHeight / 2}px`);
    }
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    el.querySelectorAll('img').forEach((im) => {
      if (!(im as HTMLImageElement).complete) im.addEventListener('load', sync, { once: true });
    });
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  function nudge(dir: 1 | -1): void {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  }

  function badgeForBook(book: CollectionBookDto): CardBadge | null {
    return badgeFor(book, badgeKind, { isBestPrice: bestPriceId != null && book.id === bestPriceId });
  }

  return (
    <div className="shelf-wrap" ref={wrapRef}>
      {/* hp-rail: reuses the Homepage rail's .kn-book card treatment (cover
          sizing, badge position, mobile typography) verbatim — no duplicate
          CSS. shelf-rail keeps owning the drag/wheel scroll mechanics. */}
      <div className="shelf-rail hp-rail" ref={railRef}>
        {books.map((book) => (
          <CollectionBookCard key={book.id} book={book} badge={badgeForBook(book)} returnTo={returnTo} />
        ))}
        <Link className="shelf-more" href={allHref}>
          <span className="shelf-more__icon">
            <CollectionIcon name="arrow-right" size={22} />
          </span>
          <span className="shelf-more__label">{allLabel ?? 'Дивитися всі'}</span>
          <span className="shelf-more__hint">Переглянути →</span>
        </Link>
      </div>
      <button type="button" className="shelf-btn shelf-btn--prev" onClick={() => nudge(-1)} disabled={!nav.left} aria-label="Прокрутити назад">
        <CollectionIcon name="chevron-left" size={22} />
      </button>
      <button type="button" className="shelf-btn shelf-btn--next" onClick={() => nudge(1)} disabled={!nav.right} aria-label="Прокрутити далі">
        <CollectionIcon name="chevron-right" size={22} />
      </button>
    </div>
  );
}
