'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CollectionDto } from '@/lib/api/types';
import { useIsMobile } from './useIsMobile';
import { CNavIcon } from './icons';

/**
 * Frozen sticky section nav (`collections-nav.jsx`, 2026-07-04 mobile-nav
 * patch): theme background with a soft green tint, accent stays
 * `var(--accent)`. Desktop (>768px, unchanged): `.cnav__links` scroll row +
 * a sibling `.cnav__genres-wrap` holding the «Жанри» trigger and its compact
 * dropdown — the wrap sits OUTSIDE the scroll container so the dropdown is
 * never clipped (never put overflow on `.cnav__row` itself). Mobile (≤768px):
 * two anchored dropdown triggers in one row — a section switcher (current
 * section's icon + label) and «Жанри» (search + scrollable icon list); the
 * old bottom sheet is gone. Both dropdowns share the same close behaviour
 * (outside pointerdown / Escape / re-click / leaving mobile) and opening one
 * closes the other. Smooth-scrolls to hub section anchors; the active item
 * follows scroll position. Genres come from the hub payload (real taxonomic
 * collections with their DB icons), not the mock's hardcoded 17-genre list.
 */

const CNAV_ITEMS = [
  { id: 'populyarne', label: 'Популярне', icon: 'flame' },
  { id: 'obrane', label: 'У бажанках', icon: 'heart' },
  { id: 'novynky', label: 'Новинки', icon: 'sparkles' },
  { id: 'znyzhky', label: 'Знижки', icon: 'badge-percent' },
  { id: 'nastroji', label: 'Настрої', icon: 'moon' },
  { id: 'redaktsiya', label: 'Колекції', icon: 'library' },
] as const;

export interface CollectionsNavProps {
  readonly genres: readonly CollectionDto[];
}

export function CollectionsNav({ genres }: CollectionsNavProps): React.JSX.Element {
  const isMobile = useIsMobile();
  const [active, setActive] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [secOpen, setSecOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genQ, setGenQ] = useState('');
  const navRef = useRef<HTMLElement | null>(null);
  const secRef = useRef<HTMLDivElement | null>(null);
  const genRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef(0);
  const activeItem = CNAV_ITEMS.find((s) => s.id === active) ?? CNAV_ITEMS[0];

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

  /* Mobile section dropdown — close on Escape / outside click / leaving mobile. */
  useEffect(() => {
    if (!secOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSecOpen(false);
    };
    const onDown = (e: PointerEvent): void => {
      if (secRef.current && !secRef.current.contains(e.target as Node)) setSecOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [secOpen]);
  /* Leaving mobile force-closes both mobile dropdowns (canonical behaviour),
     expressed as adjust-state-during-render — the repo's lint forbids the
     mock's setState-in-effect form. */
  const [wasMobile, setWasMobile] = useState(isMobile);
  if (wasMobile !== isMobile) {
    setWasMobile(isMobile);
    if (!isMobile) {
      setSecOpen(false);
      setGenOpen(false);
    }
  }

  /* Mobile genres dropdown — same close behaviour as the section dropdown. */
  useEffect(() => {
    if (!genOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setGenOpen(false);
    };
    const onDown = (e: PointerEvent): void => {
      if (genRef.current && !genRef.current.contains(e.target as Node)) setGenOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [genOpen]);

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

  const genQuery = genQ.trim().toLowerCase();
  const genList = genQuery ? genres.filter((g) => g.name.toLowerCase().includes(genQuery)) : genres;

  return (
    <nav
      className={'cnav' + (stuck ? ' cnav--stuck' : '')}
      ref={navRef}
      aria-label="Розділи сторінки добірок"
      onMouseLeave={closeMegaSoon}
      onMouseEnter={() => clearTimeout(closeTimer.current)}
    >
      <div className="page">
        {isMobile ? (
          /* MOBILE ONLY — two dropdown triggers replace the horizontal scroll
             row (2026-07-04 mobile nav patch). Desktop markup below untouched. */
          <div className="cnav__mobrow">
            <div className="cnav__sec-wrap" ref={secRef}>
              <button
                type="button"
                className="cnav__secbtn"
                aria-expanded={secOpen}
                aria-haspopup="true"
                onClick={() => {
                  setSecOpen((o) => !o);
                  setGenOpen(false);
                }}
              >
                <CNavIcon name={activeItem.icon} />
                <span className="cnav__secbtn-label">{activeItem.label}</span>
                <span className="cnav__chev">
                  <CNavIcon name="chevron-down" size={14} />
                </span>
              </button>
              {secOpen ? (
                <div className="cnav__secmenu" role="menu">
                  {CNAV_ITEMS.map((s) => (
                    <a
                      key={s.id}
                      href={'#' + s.id}
                      role="menuitem"
                      className={
                        'cnav__secmenu-item' + (active === s.id ? ' cnav__secmenu-item--active' : '')
                      }
                      onClick={(e) => {
                        go(e, s.id);
                        setSecOpen(false);
                      }}
                    >
                      <CNavIcon name={s.icon} />
                      {s.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            {genres.length > 0 ? (
              <div className="cnav__sec-wrap" ref={genRef}>
                <button
                  type="button"
                  className="cnav__secbtn"
                  aria-expanded={genOpen}
                  aria-haspopup="true"
                  onClick={() => {
                    /* Query resets on (re)open — canonical clears it on close;
                       the visible result is identical: a fresh list every open. */
                    if (!genOpen) setGenQ('');
                    setGenOpen((o) => !o);
                    setSecOpen(false);
                  }}
                >
                  <CNavIcon name="book-open" />
                  <span className="cnav__secbtn-label">Жанри</span>
                  <span className="cnav__chev">
                    <CNavIcon name="chevron-down" size={14} />
                  </span>
                </button>
                {genOpen ? (
                  <div className="cnav__secmenu cnav__secmenu--genres" role="menu">
                    <label className="cnav__secmenu-search">
                      <CNavIcon name="search" size={15} />
                      <input
                        type="text"
                        placeholder="Знайти жанр"
                        value={genQ}
                        onChange={(e) => setGenQ(e.target.value)}
                        aria-label="Пошук жанру"
                      />
                    </label>
                    <div className="cnav__secmenu-scroll">
                      {genList.map((g) => (
                        <a
                          key={g.slug}
                          href={`/zhanry/${g.slug}`}
                          role="menuitem"
                          className="cnav__secmenu-item"
                          onClick={() => setGenOpen(false)}
                        >
                          <CNavIcon name={g.icon ?? 'book-open'} />
                          {g.name}
                        </a>
                      ))}
                      {genList.length === 0 ? (
                        <div className="cnav__secmenu-empty">Нічого не знайшли.</div>
                      ) : null}
                    </div>
                    <Link href="/dobirky" className="cnav__secmenu-all" onClick={() => setGenOpen(false)}>
                      Усі жанри <CNavIcon name="arrow-right" size={15} />
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="cnav__row">
            <div className="cnav__links">
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
            </div>
            {genres.length > 0 ? (
              <div className="cnav__genres-wrap">
                <button
                  type="button"
                  className="cnav__link cnav__link--genres"
                  aria-expanded={megaOpen}
                  aria-haspopup="true"
                  onClick={() => setMegaOpen((o) => !o)}
                  onMouseEnter={openMegaSoon}
                >
                  <CNavIcon name="book-open" />
                  Жанри
                  <span className="cnav__chev">
                    <CNavIcon name="chevron-down" size={14} />
                  </span>
                </button>

                {megaOpen ? (
                  <div className="cnav__mega">
                    <div className="cnav__mega-inner">
                      <div className="cnav__mega-cols">
                        {genres.map((g) => (
                          <a
                            key={g.slug}
                            href={`/zhanry/${g.slug}`}
                            className="cnav__genre"
                            onClick={() => setMegaOpen(false)}
                          >
                            {g.name}
                          </a>
                        ))}
                      </div>
                    </div>
                    <div className="cnav__mega-foot">
                      <Link href="/dobirky" className="cnav__mega-all" onClick={() => setMegaOpen(false)}>
                        Усі жанри <CNavIcon name="arrow-right" size={17} />
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </nav>
  );
}
