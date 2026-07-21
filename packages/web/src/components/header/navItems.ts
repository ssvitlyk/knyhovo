/**
 * Frozen global-header nav item set (Global Header v1.0): «Головна · Добірки ·
 * Бажанки · Про нас» — shared between the desktop `HeaderNav` and the mobile
 * `MobileDrawer` so the active-route logic never drifts between the two.
 */

export interface NavItem {
  readonly id: string;
  readonly href: string;
  readonly label: string;
  readonly isActive: (pathname: string) => boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', href: '/', label: 'Головна', isActive: (p) => p === '/' },
  {
    id: 'dobirky',
    href: '/dobirky',
    label: 'Добірки',
    isActive: (p) => p.startsWith('/dobirky') || p.startsWith('/zhanry'),
  },
  {
    id: 'bazhanky',
    href: '/wishlist',
    label: 'Бажанки',
    isActive: (p) => p.startsWith('/wishlist'),
  },
  {
    id: 'about',
    href: '/about',
    label: 'Про нас',
    isActive: (p) => p.startsWith('/about'),
  },
];
