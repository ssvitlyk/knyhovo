'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CollectionBookCardDto } from '@/lib/api/types';
import type { CardBadge } from '@/lib/collections/badges';
import { BookCard } from './BookCard';
import { DynIcon } from './icons';
import { useWishlistHearts } from './useWishlistHearts';

/** A shelf item: the card data + its precomputed (serializable) badge. */
export interface ShelfItem {
  readonly book: CollectionBookCardDto;
  readonly badge: CardBadge | null;
}

/**
 * Horizontal-rail interactions, ported 1:1 from the frozen mock: wheel +
 * shift-wheel translate to horizontal (releasing to the page at the ends so
 * scroll is never trapped); click-drag pans (mouse only — touch uses native
 * swipe) with a soft exponential-decay fling on release; a post-drag click is
 * swallowed so panning never opens a book.
 */
function useRailInteractions(ref: RefObject<HTMLDivElement | null>): void {
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
      if (e.button !== 0) return;
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
      if (Math.abs(v) > 0.5) flingId = requestAnimationFrame(step);
      else el.classList.remove('is-dragging');
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
  readonly items: readonly ShelfItem[];
  readonly allLabel?: string;
  readonly allHref?: string;
}

/**
 * Frozen horizontal shelf: scroll rail of `.bkc` cards with a trailing dashed
 * «see all» card and hover chevron buttons aligned to the cover mid-line.
 */
export function Shelf({ items, allLabel, allHref }: ShelfProps): React.JSX.Element {
  const railRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [nav, setNav] = useState({ left: false, right: true });
  const { saved, toggle } = useWishlistHearts();
  useRailInteractions(railRef);

  // Track scroll extremes (to hide the end-stop arrow) + align the arrows to the cover mid-line.
  const sync = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setNav({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const cover = el.querySelector<HTMLElement>('.bkc__coverwrap');
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
      if (!im.complete) im.addEventListener('load', sync, { once: true });
    });
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  function nudge(dir: number): void {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  }

  return (
    <div className="shelf-wrap" ref={wrapRef}>
      <div className="shelf-rail" ref={railRef}>
        {items.map(({ book, badge }) => (
          <BookCard key={book.id} book={book} badge={badge} saved={saved.has(book.id)} onToggle={toggle} />
        ))}
        <a className="shelf-more" href={allHref ?? '#'}>
          <span className="shelf-more__icon">
            <DynIcon name="arrow-right" size={22} />
          </span>
          <span className="shelf-more__label">{allLabel ?? 'Дивитися всі'}</span>
          <span className="shelf-more__hint">Переглянути →</span>
        </a>
      </div>
      <button
        type="button"
        className="shelf-btn shelf-btn--prev"
        onClick={() => nudge(-1)}
        disabled={!nav.left}
        aria-label="Прокрутити назад"
      >
        <DynIcon name="chevron-left" size={22} />
      </button>
      <button
        type="button"
        className="shelf-btn shelf-btn--next"
        onClick={() => nudge(1)}
        disabled={!nav.right}
        aria-label="Прокрутити далі"
      >
        <DynIcon name="chevron-right" size={22} />
      </button>
    </div>
  );
}
