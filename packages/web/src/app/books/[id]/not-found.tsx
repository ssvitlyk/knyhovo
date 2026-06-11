/**
 * Route-level not-found page for the book details route. Shown when the API
 * returns 404 (BOOK_NOT_FOUND) or 400 (BAD_REQUEST / invalid id).
 */
export default function BookNotFound(): React.JSX.Element {
  return (
    <main className="results">
      <div className="kn-empty">
        <img className="kn-empty__mascot kn-empty__mascot--light" src="/mascot/mascot-magnifier.png" alt="" />
        <img className="kn-empty__mascot kn-empty__mascot--dark" src="/mascot/mascot-lantern.png" alt="" />
        <h3 className="kn-empty__title">Книгу не знайдено</h3>
        <p className="kn-empty__text">Можливо, її ще немає в нашому каталозі або посилання застаріло.</p>
        <a className="kn-btn kn-btn--primary" href="/search">
          До пошуку
        </a>
      </div>
    </main>
  );
}
