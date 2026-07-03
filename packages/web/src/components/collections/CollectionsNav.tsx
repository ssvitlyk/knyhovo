'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CollectionIcon } from './icons';
import { collectionPath, catalogPath } from '@/lib/collectionsPaths';
import type { GenreDto } from '@/lib/api/types';

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
}

/** Section anchors — ids match the `id` attributes rendered by the page's sections. */
const CNAV_ITEMS: readonly NavItem[] = [
  { id: 'populyarne', label: 'Популярне', icon: 'flame' },
  { id: 'obrane', label: 'Обране', icon: 'heart' },
  { id: 'novynky', label: 'Новинки', icon: 'sparkles' },
  { id: 'znyzhky', label: 'Знижки', icon: 'badge-percent' },
  { id: 'nastroji', label: 'Настрої', icon: 'moon' },
  { id: 'redaktsiya', label: 'Добірки', icon: 'library' },
];

function useIsMobile(bp = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${bp}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const handler = (e: MediaQueryListEvent): void => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [bp]);
  return isMobile;
}

interface GenreSheetProps {
  readonly genres: readonly GenreDto[];
  readonly onClose: () => void;
}

/** Mobile bottom sheet («Жанри») — portaled to <body>, ~80vh, searchable. */
function CNavGenreSheet({ genres, onClose }: GenreSheetProps): React.JSX.Element {
  const [q, setQ] = useState('');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const query = q.trim().toLowerCase();
  const list = query ? genres.filter((g) => g.name.toLowerCase().includes(query)) : genres;

  return createPortal(
    <>
      <div className="cnav-sheet-backdrop" onClick={onClose} />
      <div className="cnav-sheet" role="dialog" aria-modal="true" aria-label="Жанри">
        <div className="cnav-sheet__grab" />
        <div className="cnav-sheet__head">
          <div className="cnav-sheet__title">Жанри</div>
          <button type="button" className="cnav-sheet__close" onClick={onClose} aria-label="Закрити">
            <CollectionIcon name="x" size={18} />
          </button>
        </div>
        <label className="cnav-sheet__search">
          <CollectionIcon name="search" size={17} />
          <input
            type="text"
            placeholder="Знайти жанр"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Пошук жанру"
          />
        </label>
        <div className="cnav-sheet__list">
          {list.map((g) => (
            <Link key={g.slug} href={collectionPath(g.slug)} className="cnav-sheet__item" onClick={onClose}>
              {g.name}
              <CollectionIcon name="chevron-right" size={16} />
            </Link>
          ))}
          {list.length === 0 ? <div className="cnav-sheet__empty">Нічого не знайшли. Спробуйте інший запит.</div> : null}
        </div>
        <div className="cnav-sheet__foot">
          <Link href={catalogPath()} className="cnav-sheet__all" onClick={onClose}>
            Усі жанри <CollectionIcon name="arrow-right" size={17} />
          </Link>
        </div>
      </div>
    </>,
    document.body,
  );
}

export interface CollectionsNavProps {
  readonly genres: readonly GenreDto[];
}

/**
 * Sticky section nav under the site header, above the featured hero. Desktop:
 * text links + «Жанри» mega menu (hover/click). Mobile: horizontal scroll row;
 * «Жанри» opens an 80vh bottom sheet with search. Smooth-scrolls to section
 * anchors; active item follows scroll position (scroll-spy).
 */
export function CollectionsNav({ genres }: CollectionsNavProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const [active, setActive] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const els = CNAV_ITEMS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    let raf = 0;
    function measure(): void {
      raf = 0;
      const nav = navRef.current;
      const probe = (nav ? nav.getBoundingClientRect().bottom : 130) + 80;
      let cur: string | null = null;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) {
          cur = el.id;
          break;
        }
      }
      setActive(cur);
      setStuck(window.scrollY > 8);
    }
    function onScroll(): void {
      if (!raf) raf = requestAnimationFrame(measure);
    }
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    if (!megaOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMegaOpen(false);
    };
    const onDown = (e: MouseEvent): void => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [megaOpen]);

  function flashOnArrival(el: HTMLElement): void {
    const flash = (): void => {
      el.removeAttribute('data-cnav-flash');
      void el.offsetWidth; // restart animation if re-triggered
      el.setAttribute('data-cnav-flash', '');
      setTimeout(() => el.removeAttribute('data-cnav-flash'), 500);
    };
    if ('onscrollend' in window) {
      let to: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
      const onEnd = (): void => {
        clearTimeout(to);
        window.removeEventListener('scrollend', onEnd);
        flash();
      };
      window.addEventListener('scrollend', onEnd, { once: true });
      to = setTimeout(onEnd, 1100); // fallback if scrollend never fires
    } else {
      setTimeout(flash, 650);
    }
  }

  function go(e: React.MouseEvent, id: string): void {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const navH = navRef.current ? navRef.current.offsetHeight : 70;
    // The sticky header (logo 44px + 2×--space-5 20px = 84px) stays pinned above
    // the nav, so the anchor target must clear the full header + nav block.
    const headH = 84;
    const top = el.getBoundingClientRect().top + window.scrollY - headH - navH + 2;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    setMegaOpen(false);
    flashOnArrival(el);
  }

  function openMegaSoon(): void {
    if (isMobile) return;
    clearTimeout(closeTimer.current);
    setMegaOpen(true);
  }
  function closeMegaSoon(): void {
    if (isMobile) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMegaOpen(false), 140);
  }

  return (
    <nav
      className={'cnav' + (stuck ? ' cnav--stuck' : '')}
      ref={navRef}
      aria-label="Розділи сторінки добірок"
      onMouseLeave={closeMegaSoon}
      onMouseEnter={() => clearTimeout(closeTimer.current)}
    >
      <div className="page">
        <div className="cnav__row">
          {CNAV_ITEMS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={'cnav__link' + (active === s.id ? ' cnav__link--active' : '')}
              onClick={(e) => go(e, s.id)}
            >
              <CollectionIcon name={s.icon} />
              {s.label}
            </a>
          ))}
          <button
            type="button"
            className="cnav__link cnav__link--genres"
            aria-expanded={megaOpen}
            aria-haspopup="true"
            onClick={() => (isMobile ? setSheetOpen(true) : setMegaOpen((o) => !o))}
            onMouseEnter={openMegaSoon}
          >
            <CollectionIcon name="book-open" />
            Жанри
            <span className="cnav__chev">
              <CollectionIcon name="chevron-down" size={14} />
            </span>
          </button>
        </div>
      </div>

      {!isMobile && megaOpen ? (
        <div className="cnav__mega">
          <div className="page">
            <div className="cnav__mega-inner">
              <div className="cnav__mega-cols">
                {genres.map((g) => (
                  <Link key={g.slug} href={collectionPath(g.slug)} className="cnav__genre" onClick={() => setMegaOpen(false)}>
                    {g.name}
                  </Link>
                ))}
              </div>
              <div className="cnav__mega-foot">
                <Link href={catalogPath()} className="cnav__mega-all" onClick={() => setMegaOpen(false)}>
                  Усі жанри <CollectionIcon name="arrow-right" size={17} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isMobile && sheetOpen ? <CNavGenreSheet genres={genres} onClose={() => setSheetOpen(false)} /> : null}
    </nav>
  );
}
