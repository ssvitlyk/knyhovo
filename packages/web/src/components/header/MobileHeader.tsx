'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { KnhIcon } from './KnhIcon';
import { MobileSearchOverlay } from './MobileSearchOverlay';
import { MobileDrawer } from './MobileDrawer';

export interface MobileHeaderProps {
  readonly wishlistCount: number;
  readonly authenticated: boolean;
}

/**
 * Mobile icon cluster (`.knh__mob`, hidden on desktop) — wishlist heart,
 * search, burger. Search opens a top overlay; burger opens a right drawer.
 * Body scroll is locked while either is open; Escape closes both; switching
 * to desktop width (matchMedia ≥769px) closes both.
 */
export function MobileHeader({ wishlistCount, authenticated }: MobileHeaderProps): React.JSX.Element {
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const anyOpen = searchOpen || drawerOpen;

  useEffect(() => {
    if (!anyOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setDrawerOpen(false);
      }
    }
    const mq = window.matchMedia('(min-width: 769px)');
    function onMq(): void {
      if (mq.matches) {
        setSearchOpen(false);
        setDrawerOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    mq.addEventListener('change', onMq);
    return () => {
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onMq);
    };
  }, []);

  return (
    <>
      <div className="knh__mob">
        <Link
          className="knh__iconbtn"
          href="/wishlist"
          aria-label={'Бажанки' + (wishlistCount ? ` (${wishlistCount})` : '')}
        >
          <KnhIcon name="heart" size={21} />
          {wishlistCount > 0 && <span className="knh__count">{wishlistCount}</span>}
        </Link>
        <button
          type="button"
          className="knh__iconbtn"
          aria-label="Пошук"
          onClick={() => setSearchOpen(true)}
        >
          <KnhIcon name="search" size={21} />
        </button>
        <button
          type="button"
          className="knh__iconbtn"
          aria-label="Меню"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <KnhIcon name="menu" size={22} />
        </button>
      </div>

      {searchOpen && <MobileSearchOverlay onClose={() => setSearchOpen(false)} />}
      {drawerOpen && (
        <MobileDrawer
          authenticated={authenticated}
          wishlistCount={wishlistCount}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
