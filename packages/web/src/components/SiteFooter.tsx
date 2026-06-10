/**
 * Reused site footer (frozen). Always present across results/loading/empty/error
 * states. Logo is theme-swapped via CSS, identical to the header.
 */
export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="site-footer">
      <img className="footer-logo site-logo--light" src="/logo/knyhovo-logo-light.png" alt="Knyhovo" />
      <img className="footer-logo site-logo--dark" src="/logo/knyhovo-logo-dark.png" alt="Knyhovo" />
      <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
      <p className="footer-copy">© 2026 Knyhovo</p>
    </footer>
  );
}
