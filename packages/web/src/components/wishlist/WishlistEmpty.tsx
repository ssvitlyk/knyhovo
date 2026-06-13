/**
 * WishlistEmpty — state shown when the user has no wishlist items.
 * Mascot illustration + headline + CTA linking to search.
 * Theme-aware mascot swap via CSS (same pattern as EmptyState / bd-unavail).
 */
export function WishlistEmpty(): React.JSX.Element {
  return (
    <div className="wl-empty">
      <img
        className="wl-empty__mascot wl-empty__mascot--light"
        src="/mascot/mascot-magnifier.png"
        alt=""
      />
      <img
        className="wl-empty__mascot wl-empty__mascot--dark"
        src="/mascot/mascot-lantern.png"
        alt=""
      />
      <h2 className="wl-empty__title">
        Не просто зберігайте книги — купуйте їх у правильний момент.
      </h2>
      <p className="wl-empty__text">
        Додайте книгу — щодня о 08:00 Knyhovo перевірить ціни у 5 книгарнях,
        а Книговик підкаже, коли настане час купувати.
      </p>
      <a className="kn-btn kn-btn--primary" href="/search">
        Знайти книги
      </a>
    </div>
  );
}
