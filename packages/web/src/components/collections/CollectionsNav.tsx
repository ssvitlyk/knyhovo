'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CollectionDto } from '@/lib/api/types';
import { useIsMobile } from './useIsMobile';
import { CNavIcon } from './icons';

/**
 * Frozen sticky section nav (`collections-nav.jsx`): dark ink bar in BOTH
 * themes, gold accent only. Desktop: pill links + «Жанри» mega menu
 * (hover/click). Mobile: horizontal scroll row; «Жанри» opens a bottom sheet
 * with search. Smooth-scrolls to hub section anchors; the active item follows
 * scroll position. Genres come from the hub payload (real taxonomic
 * collections), not the mock's hardcoded 17-genre list.
 */

const CNAV_ITEMS = [
  { id: 'populyarne', label: 'Популярне', icon: 'flame' },
  { id: 'obrane', label: 'Обране', icon: 'heart' },
  { id: 'novynky', label: 'Новинки', icon: 'sparkles' },
  { id: 'znyzhky', label: 'Знижки', icon: 'badge-percent' },
  { id: 'nastroji', label: 'Настрої', icon: 'moon' },
  { id: 'redaktsiya', label: 'Добірки', icon: 'library' },
] as const;

/** Bottom sheet (mobile «Жанри») — portaled to <body> so it escapes the nav's stacking context. */
function CNavGenreSheet({
  genres,
  onClose,
}: {
  readonly genres: readonly CollectionDto[];
  readonly onClose: () => void;
}): React.JSX.Element {
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
            <CNavIcon name="x" size={18} />
          </button>
        </div>
        <label className="cnav-sheet__search">
          <CNavIcon name="search" size={17} />
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
            <a key={g.slug} href={`/zhanry/${g.slug}`} className="cnav-sheet__item" onClick={onClose}>
              {g.name}
              <CNavIcon name="chevron-right" size={16} />
            </a>
          ))}
          {list.length === 0 ? (
            <div className="cnav-sheet__empty">Нічого не знайшли. Спробуйте інший запит.</div>
          ) : null}
        </div>
        <div className="cnav-sheet__foot">
          <Link href="/dobirky#zhanry" className="cnav-sheet__all" onClick={onClose}>
            Усі жанри <CNavIcon name="arrow-right" size={17} />
          </Link>
        </div>
      </div>
    </>,
    document.body,
  );
}

export interface CollectionsNavProps {
  readonly genres: readonly CollectionDto[];
}

export function CollectionsNav({ genres }: CollectionsNavProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const [active, setActive] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef(0);

  /* Scroll-spy: the section whose box crosses the probe line (just under the sticky bar) is active. */
  useEffect(() => {
    const els = CNAV_ITEMS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
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
      if (raf === 0) raf = requestAnimationFrame(measure);
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

  /* Close mega on Escape / outside click. */
  useEffect(() => {
    if (!megaOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMegaOpen(false);
    };
    const onDown = (e: PointerEvent): void => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMegaOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [megaOpen]);

  function go(e: React.MouseEvent, id: string): void {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const navH = navRef.current ? navRef.current.offsetHeight : 70;
    const top = el.getBoundingClientRect().top + window.scrollY - navH + 2;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    setMegaOpen(false);
    flashOnArrival(el);
  }

  /* After the smooth scroll settles, give the target a short one-shot fade-in. */
  function flashOnArrival(el: HTMLElement): void {
    const flash = (): void => {
      el.removeAttribute('data-cnav-flash');
      void el.offsetWidth; /* restart animation if re-triggered */
      el.setAttribute('data-cnav-flash', '');
      setTimeout(() => el.removeAttribute('data-cnav-flash'), 500);
    };
    if ('onscrollend' in window) {
      let to = 0;
      const onEnd = (): void => {
        clearTimeout(to);
        window.removeEventListener('scrollend', onEnd);
        flash();
      };
      window.addEventListener('scrollend', onEnd, { once: true });
      to = window.setTimeout(onEnd, 1100); /* fallback if scrollend never fires */
    } else {
      setTimeout(flash, 650);
    }
  }

  function openMegaSoon(): void {
    if (isMobile) return;
    clearTimeout(closeTimer.current);
    setMegaOpen(true);
  }
  function closeMegaSoon(): void {
    if (isMobile) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMegaOpen(false), 140);
  }

  return (
    <nav
      className={'cnav' + (stuck ? ' cnav--stuck' : '')}
      ref={navRef}
      aria-label="Розділи сторінки добірок"
      onMouseLeave={closeMegaSoon}
      onMouseEnter={() => clearTimeout(closeTimer.current)}
    >
      <div className="cnav__bar">
        <div className="cnav__row">
          {CNAV_ITEMS.map((s) => (
            <a
              key={s.id}
              href={'#' + s.id}
              className={'cnav__link' + (active === s.id ? ' cnav__link--active' : '')}
              onClick={(e) => go(e, s.id)}
            >
              <CNavIcon name={s.icon} />
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
            <CNavIcon name="book-open" />
            Жанри
            <span className="cnav__chev">
              <CNavIcon name="chevron-down" size={14} />
            </span>
          </button>
        </div>
      </div>

      {!isMobile && megaOpen ? (
        <div className="cnav__mega">
          <div className="cnav__mega-inner">
            <div className="cnav__mega-cols">
              {genres.map((g) => (
                <a key={g.slug} href={`/zhanry/${g.slug}`} className="cnav__genre" onClick={() => setMegaOpen(false)}>
                  {g.name}
                </a>
              ))}
            </div>
            <div className="cnav__mega-foot">
              <Link href="/dobirky#zhanry" className="cnav__mega-all" onClick={() => setMegaOpen(false)}>
                Усі жанри <CNavIcon name="arrow-right" size={17} />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {isMobile && sheetOpen ? <CNavGenreSheet genres={genres} onClose={() => setSheetOpen(false)} /> : null}
    </nav>
  );
}
