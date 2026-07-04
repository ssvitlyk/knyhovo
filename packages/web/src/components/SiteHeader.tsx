import Link from 'next/link';
import { cookies } from 'next/headers';
import { ThemeToggle } from '@/components/ds/ThemeToggle';
import { HeaderSearch } from '@/components/header/HeaderSearch';
import { HeaderNav } from '@/components/header/HeaderNav';
import { MobileHeader } from '@/components/header/MobileHeader';
import { HeaderAuthActions, type HeaderUser } from '@/components/auth/HeaderAuthActions';
import { me } from '@/lib/api/auth';
import { getWishlist } from '@/lib/api/wishlist';

/**
 * Global Header v1.0 (frozen design) — server shell that resolves auth session
 * and wishlist count once per request; `HeaderSearch`, `HeaderNav`,
 * `MobileHeader`, `ThemeToggle` and the auth control are the client islands.
 * Session is resolved server-side (forwarding the cookie to `/api/auth/me`) so
 * the header reflects auth state on every full render — guest → «Увійти»,
 * authenticated → account menu. The wishlist badge count is resolved the same
 * way, only for an authenticated user; any lookup error (auth or wishlist)
 * degrades gracefully (guest state / count 0) so a flaky API never breaks the
 * whole layout.
 */
export async function SiteHeader(): Promise<React.JSX.Element> {
  let user: HeaderUser | null = null;
  try {
    const cookie = (await cookies()).toString();
    user = await me(cookie);
  } catch {
    user = null;
  }

  let wishlistCount = 0;
  if (user != null) {
    try {
      const cookie = (await cookies()).toString();
      const result = await getWishlist({ cookie });
      wishlistCount = 'unauthorized' in result ? 0 : result.items.length;
    } catch {
      wishlistCount = 0;
    }
  }

  return (
    <header className="knh">
      <div className="knh__page">
        <div className="knh__row">
          <Link className="knh__brand" href="/" aria-label="Knyhovo — на головну">
            <img className="knh__logo knh__logo--light" src="/logo/knyhovo-logo-light.png" alt="Knyhovo" />
            <img className="knh__logo knh__logo--dark" src="/logo/knyhovo-logo-dark.png" alt="Knyhovo" />
          </Link>

          <HeaderSearch />

          <HeaderNav wishlistCount={wishlistCount} />

          <div className="knh__actions">
            <ThemeToggle />
            <HeaderAuthActions user={user} />
          </div>

          <MobileHeader wishlistCount={wishlistCount} authenticated={user != null} />
        </div>
      </div>
    </header>
  );
}
