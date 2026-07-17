import { formatMoney, knBookWord } from '@/lib/format';

export interface WishlistHeroProps {
  /** N — total wishlist book count. */
  readonly totalWishlistCount: number;
  /** M — count of current buying opportunities. */
  readonly opportunitiesCount: number;
  /** Sum of `savingsAmount` across all opportunities, kopiyky. */
  readonly totalSavings: number;
  readonly currency: string;
}

/**
 * Wishlist v2.2 Hero (Server component) — Variant A, port of `WL21Hero`.
 * Approved copy deviations vs the frozen mock (owner decisions, see the plan):
 *  - Eyebrow uses real Ukrainian pluralization (`knBookWord`) instead of the
 *    mock's hardcoded «книги».
 *  - KPI label is «Разом можна заощадити» (not «Вже заощадили» — this is a
 *    forward-looking potential-savings figure, not an accumulated one) and the
 *    panel is hidden entirely when the sum is 0 (owner decision №3); the
 *    headline stays frozen («0 із N») regardless.
 */
export function WishlistHero({
  totalWishlistCount,
  opportunitiesCount,
  totalSavings,
  currency,
}: WishlistHeroProps): React.JSX.Element {
  return (
    <section className="wl21-hero reveal">
        <img
          className="wl21-hero__mascot wl21-hero__mascot--light"
          src="/mascot/mascot-reading-chair-light-hybrid.png"
          alt="Книговик читає у кріслі"
        />
        <img
          className="wl21-hero__mascot wl21-hero__mascot--dark"
          src="/mascot/mascot-reading-chair-dark-final.png"
          alt="Книговик читає у кріслі"
        />
        <div className="wl21-hero__main">
          <span className="wl21-hero__badge">
            Бажанки · {totalWishlistCount} {knBookWord(totalWishlistCount)} під наглядом
          </span>
          <h1 className="wl21-hero__title">
            Сьогодні вигідний момент для{' '}
            <b>
              {opportunitiesCount} із {totalWishlistCount}
            </b>{' '}
            ваших книг.
          </h1>
          <p className="wl21-hero__desc">
            Knyhovo щодня стежить за цінами і повідомляє, коли настав вигідний момент.
          </p>
        </div>
        <div className="wl21-hero__side">
          {totalSavings > 0 ? (
            <div className="wl21-kpi">
              <span className="wl21-kpi__label">Разом можна заощадити</span>
              <b className="wl21-kpi__num">{formatMoney({ amount: totalSavings, currency })}</b>
            </div>
          ) : null}
          <span className="sec-fresh wl21-hero__fresh">
            <span className="sec-fresh__dot" />
            Перевірено сьогодні
          </span>
        </div>
    </section>
  );
}
