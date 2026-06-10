import { Button } from '@/components/ds/Button';
import { ThemeToggle } from '@/components/ds/ThemeToggle';

/**
 * Reused site header (frozen). Logo lockups are theme-swapped via CSS so the
 * header stays a Server Component; the `ThemeToggle` child is the only client
 * island. Nav links and "Увійти" are static — their routes don't exist yet.
 */
export function SiteHeader(): React.JSX.Element {
  return (
    <header className="site-header">
      <a href="/search" aria-label="Knyhovo">
        <img className="site-logo site-logo--light" src="/logo/knyhovo-logo-light.png" alt="Knyhovo" />
        <img className="site-logo site-logo--dark" src="/logo/knyhovo-logo-dark.png" alt="Knyhovo" />
      </a>
      <nav className="site-nav">
        <a href="#" className="nav-link">
          Головна
        </a>
        <a href="/search" className="nav-link nav-link--active">
          Каталог
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
        <Button variant="secondary" size="sm">
          Увійти
        </Button>
      </div>
    </header>
  );
}
