'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Frozen header nav (Collections chrome, `collections-app.jsx` site-header):
 * «Головна · Добірки · Бажанки · Про нас» — exactly these four items, no
 * Каталог/Знижки. The mock hardcodes «Добірки» active (single-page canvas);
 * in the app the active item follows the current route. Client component only
 * for `usePathname` — markup and classes stay the frozen chrome.
 */

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Головна', isActive: (p) => p === '/' },
  {
    href: '/dobirky',
    label: 'Добірки',
    isActive: (p) => p.startsWith('/dobirky') || p.startsWith('/zhanry'),
  },
  { href: '/wishlist', label: 'Бажанки', isActive: (p) => p.startsWith('/wishlist') },
];

export function SiteNav(): React.JSX.Element {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="site-nav">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={'nav-link' + (item.isActive(pathname) ? ' nav-link--active' : '')}
        >
          {item.label}
        </Link>
      ))}
      <a href="#" className="nav-link">
        Про нас
      </a>
    </nav>
  );
}
