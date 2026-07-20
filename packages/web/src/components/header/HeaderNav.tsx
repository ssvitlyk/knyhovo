'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './navItems';

export interface HeaderNavProps {
  readonly wishlistCount: number;
}

/**
 * Desktop nav (`.knh__nav`) — «Головна · Добірки · Бажанки (+rose badge) ·
 * Про нас», frozen v1.0 link recipe. Client component only for `usePathname`;
 * markup/classes are the frozen chrome.
 */
export function HeaderNav({ wishlistCount }: HeaderNavProps): React.JSX.Element {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="knh__nav" aria-label="Основна навігація">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={'knh__link' + (item.isActive(pathname) ? ' knh__link--active' : '')}
        >
          {item.label}
          {item.id === 'bazhanky' && wishlistCount > 0 && (
            <span className="knh__badge">{wishlistCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
