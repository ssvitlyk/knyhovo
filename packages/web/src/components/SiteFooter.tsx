/**
 * Reused site footer (frozen). Always present across results/loading/empty/error
 * states. Logo is theme-swapped via CSS (`.footer-logo--*` — the footer's own
 * copy of the recipe; the header's `.knh__logo--*` swap is independent).
 */
export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="site-footer">
      {/* Transparent lockups (frozen chrome §8) — no visible box on either theme. */}
      <img className="footer-logo footer-logo--light" src="/logo/knyhovo-logo-light-trans.png" alt="Knyhovo" />
      <img className="footer-logo footer-logo--dark" src="/logo/knyhovo-logo-dark-trans.png" alt="Knyhovo" />
      <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
      <p className="footer-copy">© 2026 Knyhovo</p>
    </footer>
  );
}
