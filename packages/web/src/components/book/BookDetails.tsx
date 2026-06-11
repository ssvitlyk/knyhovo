import type { BookDetailsDto } from '@/lib/api/types';
import { BookMeta } from './BookMeta';
import { OffersPanel } from './OffersPanel';

/**
 * BookDetails — main two-column layout for the book details page.
 * Left column: cover, title/author, description (or hint), metadata.
 * Right column: offers panel with best price and per-provider rows.
 */
export function BookDetails({ book }: { readonly book: BookDetailsDto }): React.JSX.Element {
  return (
    <div className="bdc-grid">
      <div className="bdc-left">
        <div className="bdc-idrow">
          {book.coverUrl ? (
            <img className="bd-cover bd-cover--md" src={book.coverUrl} alt="" />
          ) : (
            <div className="bd-cover bd-cover--md" aria-hidden="true">
              <span>Обкладинка</span>
            </div>
          )}
          <div>
            <h1 className="bd-h1">{book.title}</h1>
            <p className="bd-author">{book.author}</p>
          </div>
        </div>
        {book.description ? (
          <div className="bd-desc">
            <p>{book.description}</p>
          </div>
        ) : (
          <div className="bd-hint">
            Опис ще не додано — ми збираємо інформацію про це видання. Зазвичай це триває до одного дня.
          </div>
        )}
        <h2 className="bd-h2" style={{ marginTop: 'var(--space-8)' }}>
          Про видання
        </h2>
        <BookMeta isbn={book.isbn} />
      </div>
      <OffersPanel providers={book.providers} lowestPrice={book.lowestPrice} offersCount={book.offersCount} />
    </div>
  );
}
