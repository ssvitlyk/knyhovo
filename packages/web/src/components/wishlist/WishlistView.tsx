import { WishlistEmpty } from './WishlistEmpty';
import { WishlistRow } from './WishlistRow';
import { WishlistCard } from './WishlistCard';
import { alertUiState } from '@/lib/alerts';
import type { WishlistItemDto } from '@/lib/api/types';

export interface WishlistViewProps {
  readonly items: readonly WishlistItemDto[];
}

/**
 * WishlistView — renders either the empty state or the two-section list.
 * Desktop (≥768px): WishlistRow grid rows inside each section.
 * Mobile (<768px):  WishlistCard accordions inside each section.
 * Both are rendered in the DOM; CSS `.wl-show-desktop` / `.wl-show-mobile`
 * toggles visibility at the breakpoint.
 *
 * Sections:
 *   1. «Книги зі знижками» — triggered items (alert status=triggered) promoted here;
 *      falls back to the quiet banner when none are triggered.
 *   2. «Інші бажанки» — all remaining (non-triggered) items.
 */
export function WishlistView({ items }: WishlistViewProps): React.JSX.Element {
  if (items.length === 0) return <WishlistEmpty />;

  const triggered = items.filter((i) => alertUiState(i.alert) === 'triggered');
  const rest = items.filter((i) => alertUiState(i.alert) !== 'triggered');

  return (
    <>
      {/* Hero */}
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">
            БАЖАНКИ · {items.length} {itemsLabel(items.length)}
          </p>
          <h1 className="v1-h1">
            Бажанки, за якими стежить <em>Книговик</em>.
          </h1>
          <p className="v1-sub">
            Не просто зберігайте книги — купуйте їх у правильний момент.
            Книговик підкаже, коли настане час купувати.
          </p>
        </div>
      </div>

      <div className="v1-single">
        {/* Section 1 — Книги зі знижками (compact when empty) */}
        <section
          className={triggered.length === 0 ? 'hy-front hy-front--empty' : 'hy-front'}
          aria-label="Книги зі знижками"
        >
          <div className="hy-group-head">
            <h2 className="hy-group-title">Книги зі знижками</h2>
            <span className="hy-group-count">{triggered.length}</span>
          </div>

          {triggered.length > 0 ? (
            <>
              {/* Desktop rows (hidden on mobile via CSS) */}
              <div className="v1-rows wl-show-desktop">
                {triggered.map((item) => (
                  <WishlistRow key={item.book.id} item={item} />
                ))}
              </div>

              {/* Mobile cards (hidden on desktop via CSS) */}
              <div className="hy-mcards wl-show-mobile">
                {triggered.map((item) => (
                  <WishlistCard key={item.book.id} item={item} />
                ))}
              </div>
            </>
          ) : (
            <p className="hy-front-empty">
              Поки що книг зі знижками немає.
              <br />
              Книговик повідомить, коли одна із ваших книг подешевшає.
            </p>
          )}
        </section>

        {/* Section 2 — Інші бажанки */}
        <section className="hy-group" aria-label="Інші бажанки">
          <div className="hy-group-head">
            <h2 className="hy-group-title">Інші бажанки</h2>
            <span className="hy-group-count">{rest.length}</span>
          </div>

          {/* Desktop rows (hidden on mobile via CSS) */}
          <div className="v1-rows wl-show-desktop">
            {rest.map((item) => (
              <WishlistRow key={item.book.id} item={item} />
            ))}
          </div>

          {/* Mobile cards (hidden on desktop via CSS) */}
          <div className="hy-mcards wl-show-mobile">
            {rest.map((item) => (
              <WishlistCard key={item.book.id} item={item} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

/** Ukrainian plural for "книга" in the eyebrow count. */
function itemsLabel(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'КНИГА';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'КНИГИ';
  return 'КНИГ';
}
