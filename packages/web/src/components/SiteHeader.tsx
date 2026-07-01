import Link from 'next/link';
import { cookies } from 'next/headers';
import { ThemeToggle } from '@/components/ds/ThemeToggle';
import { HeaderAuthActions, type HeaderUser } from '@/components/auth/HeaderAuthActions';
import { me } from '@/lib/api/auth';

/**
 * Reused site header (frozen design). Logo lockups are theme-swapped via CSS so
 * the header stays a Server Component; `ThemeToggle` and the auth control are the
 * client islands. The session is resolved server-side (forwarding the cookie to
 * `/api/auth/me`) so the header reflects auth state on every full render —
 * guest → «Увійти», authenticated → account menu. Any lookup error degrades to
 * the guest state so a flaky API never breaks the whole layout.
 */
export async function SiteHeader(): Promise<React.JSX.Element> {
  let user: HeaderUser | null = null;
  try {
    const cookie = (await cookies()).toString();
    user = await me(cookie);
  } catch {
    user = null;
  }

  return (
    <header className="site-header">
      <Link href="/" aria-label="Knyhovo">
        <img className="site-logo site-logo--light" src="/logo/knyhovo-logo-light.png" alt="Knyhovo" />
        <img className="site-logo site-logo--dark" src="/logo/knyhovo-logo-dark.png" alt="Knyhovo" />
      </Link>
      <nav className="site-nav">
        <Link href="/" className="nav-link">
          Головна
        </Link>
        <a href="/search" className="nav-link nav-link--active">
          Каталог
        </a>
        <a href="/wishlist" className="nav-link">
          Бажанки
        </a>
        <a href="#" className="nav-link">
          Знижки
        </a>
        <a href="#" className="nav-link">
          Про нас
        </a>
      </nav>
      <div className="site-actions">
        <ThemeToggle />
        <HeaderAuthActions user={user} />
      </div>
    </header>
  );
}
