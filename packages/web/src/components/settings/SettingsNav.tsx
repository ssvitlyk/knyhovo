'use client';

import { usePathname } from 'next/navigation';

const ITEMS = [
  { id: 'profile', label: 'Профіль', href: '/settings/profile' },
  { id: 'notifications', label: 'Сповіщення', href: '/settings/notifications' },
  { id: 'security', label: 'Безпека та вхід', href: null },
] as const;

/**
 * SettingsNav — sidebar navigation for the Settings section.
 * Implemented items are rendered as links; non-implemented items are
 * inert `<span>` elements with `aria-disabled="true"`.
 */
export function SettingsNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="np-sidenav" aria-label="Налаштування">
      <span className="np-sidenav__label">Налаштування</span>
      {ITEMS.map((item) => {
        const isActive = item.href != null && pathname === item.href;
        if (item.href == null) {
          return (
            <span
              key={item.id}
              className="np-sidenav__item"
              aria-disabled="true"
            >
              {item.label}
            </span>
          );
        }
        return (
          <a
            key={item.id}
            href={item.href}
            className={['np-sidenav__item', isActive ? 'np-sidenav__item--active' : ''].filter(Boolean).join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
