'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ds/Button';
import { ThemeToggle } from '@/components/ds/ThemeToggle';
import { useLoginModal } from '@/components/auth/LoginModalProvider';
import { isSafeReturnTo } from '@/lib/returnTo';
import { logout } from '@/lib/api/auth';
import { hardNavigate } from '@/lib/navigate';
import { KnhIcon } from './KnhIcon';
import { NAV_ITEMS } from './navItems';

export interface MobileDrawerProps {
  readonly authenticated: boolean;
  readonly wishlistCount: number;
  readonly onClose: () => void;
}

/**
 * Mobile menu drawer (`.knh-dr`) — right sheet with nav, auth and theme
 * toggle. Guest: Головна · Добірки · Про нас + «Увійти». Authenticated: adds
 * Бажанки (+badge), Профіль, Вийти (muted). «Увійти» reuses the exact
 * LoginButton mechanics; «Вийти» reuses the AccountMenu busy-guard logout.
 */
export function MobileDrawer({ authenticated, wishlistCount, onClose }: MobileDrawerProps): React.JSX.Element {
  const pathname = usePathname() ?? '/';
  const { openLogin } = useLoginModal();
  const [busy, setBusy] = useState(false);

  const links = NAV_ITEMS.filter((item) => authenticated || item.id !== 'bazhanky');

  function handleLogin(): void {
    const path = window.location.pathname + window.location.search;
    openLogin(isSafeReturnTo(path) ? path : null);
    onClose();
  }

  async function handleLogout(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } catch {
      // Even if the network call fails, drop the user to the guest home; the
      // cookie is httpOnly and the server will re-evaluate the session there.
    }
    hardNavigate('/');
  }

  return (
    <div className="knh-dr" role="dialog" aria-modal="true" aria-label="Меню">
      <div className="knh-dr__backdrop" onClick={onClose} />
      <div className="knh-dr__panel">
        <div className="knh-dr__head">
          <span className="knh-dr__title">Меню</span>
          <button type="button" className="knh__iconbtn" aria-label="Закрити меню" onClick={onClose}>
            <KnhIcon name="x" size={22} />
          </button>
        </div>
        <nav className="knh-dr__nav" aria-label="Основна навігація">
          {links.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={onClose}
              className={'knh-dr__item' + (item.isActive(pathname) ? ' knh-dr__item--active' : '')}
            >
              {item.label}
              {item.id === 'bazhanky' && wishlistCount > 0 && (
                <span className="knh__badge">{wishlistCount}</span>
              )}
            </Link>
          ))}
          <a href="#" className="knh-dr__item" onClick={onClose}>
            Про нас
          </a>
          {authenticated && (
            <>
              <Link href="/settings/profile" className="knh-dr__item" onClick={onClose}>
                <KnhIcon name="user" size={18} />
                Профіль
              </Link>
              <button
                type="button"
                className="knh-dr__item knh-dr__item--muted"
                disabled={busy}
                onClick={() => void handleLogout()}
              >
                <KnhIcon name="log-out" size={18} />
                Вийти
              </button>
            </>
          )}
        </nav>
        {!authenticated && (
          <div className="knh-dr__auth">
            <Button variant="secondary" onClick={handleLogin}>
              Увійти
            </Button>
          </div>
        )}
        <div className="knh-dr__theme">
          <span>Тема</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
