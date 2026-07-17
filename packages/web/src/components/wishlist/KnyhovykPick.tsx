import type { ReactNode } from 'react';
import type { KnyhovykStatus, KnyhovykStatusKind } from '@/lib/knyhovyk-status';
import Link from 'next/link';
import { formatMoney } from '@/lib/format';
import { AdaptiveBuyCta } from './AdaptiveBuyCta';
import { StatusBadge } from './StatusBadge';

export interface KnyhovykPickProps {
  readonly bookId: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string | null;
  readonly status: KnyhovykStatus;
  /** Current price of the best in-stock offer, kopiyky. */
  readonly price: number;
  readonly prevPrice: number | null;
  readonly targetPrice: number | null;
  readonly currency: string;
  readonly storeDisplayName: string;
  /** External store CTA URL. */
  readonly ctaHref: string;
  /** Curator override for the message body (replaces the derived status copy). */
  readonly note?: string;
}

const EYEBROW: Readonly<Record<KnyhovykStatusKind, string>> = {
  goal: 'Настав момент купити',
  best: 'Найкраща ціна за весь час',
  drop: 'Ціна щойно знизилася',
  // Owner decision №1: label itself lives in `deriveKnyhovykStatus` (deal → «Найбільша знижка»);
  // this eyebrow text is unaffected by that label deviation.
  deal: 'Вигідна знижка сьогодні',
  low90: 'Найнижча ціна за 90 днів',
  none: 'Вигідний момент купити',
};

function buildMessage(kind: KnyhovykStatusKind, props: KnyhovykPickProps): ReactNode {
  const { price, prevPrice, targetPrice, currency, storeDisplayName } = props;
  const money = (amount: number): string => formatMoney({ amount, currency });

  switch (kind) {
    case 'goal':
      // Owner decision №2: no "— це найнижча ціна за останні 6 місяців" clause.
      return (
        <>
          Ви встановили бажану ціну <b>{money(targetPrice ?? price)}</b>. Сьогодні книга коштує{' '}
          <b>{money(price)}</b>.
        </>
      );
    case 'best':
      return (
        <>
          Відколи ви додали книгу до бажанок, ціна ще ніколи не була нижчою за <b>{money(price)}</b>.
        </>
      );
    case 'drop': {
      const save = prevPrice != null ? Math.max(0, prevPrice - price) : 0;
      return (
        <>
          Із моменту, коли ви додали книгу до бажанок, ціна знизилася на <b>{money(save)}</b> — до{' '}
          {money(price)}.
        </>
      );
    }
    case 'deal':
      return (
        <>
          {storeDisplayName} пропонує книгу за <b>{money(price)}</b> замість{' '}
          {money(prevPrice ?? price)} — суттєво вигідніше, ніж зазвичай.
        </>
      );
    case 'low90':
      return (
        <>
          За останні 90 днів книга ще не коштувала менше, ніж сьогоднішні <b>{money(price)}</b>.
        </>
      );
    case 'none':
    default:
      return (
        <>
          {storeDisplayName}: <b>{money(price)}</b> — вигідна ціна серед книг у ваших бажанках.
        </>
      );
  }
}

/**
 * «Порада Книговика» — the curated pick (Server component), port of
 * `WL21Featured`. Renders BOTH the desktop (`.wl21-feat`) and mobile
 * (`.wl21-featm`) layouts; visibility is switched by CSS
 * (`.wl-pick-desktop`/`.wl-pick-mobile`), not `matchMedia` (server-rendered).
 */
export function KnyhovykPick(props: KnyhovykPickProps): React.JSX.Element {
  const { bookId, title, author, coverUrl, status, price, prevPrice, currency, ctaHref } = props;
  const eyebrow = EYEBROW[status.kind];
  const message = props.note != null ? props.note : buildMessage(status.kind, props);
  const detailsHref = `/books/${bookId}`;

  return (
    <div className="sec" data-screen-label={eyebrow}>
        <div className="wl-pick-desktop">
          <section
            className={`wl21-feat reveal${status.label == null ? ' wl21-feat--nostamp' : ''}`}
          >
            <StatusBadge label={status.label} variant="desktop" />
            <div className="wl21-feat__cover">
              <div className="wl21-feat__coverclip">
                {coverUrl != null ? <img src={coverUrl} alt="" /> : null}
              </div>
            </div>
            <div className="wl21-feat__body">
              <span className="wl21-feat__eyebrow">{eyebrow}</span>
              <h2 className="wl21-feat__title">{title}</h2>
              <p className="wl21-feat__author">{author}</p>
              <p className="wl21-feat__msg">{message}</p>
            </div>
            <div className="wl21-feat__side">
              <div className="wl21-feat__price">
                <b>{formatMoney({ amount: price, currency })}</b>
                {prevPrice != null && prevPrice > price ? (
                  <s>{formatMoney({ amount: prevPrice, currency })}</s>
                ) : null}
              </div>
              <span className="wl21-feat__store">{props.storeDisplayName}</span>
              <AdaptiveBuyCta
                price={price}
                currency={currency}
                href={ctaHref}
                className="wl21-feat__buy"
              />
              <Link className="wl21-feat__details" href={detailsHref}>
                Деталі книги
              </Link>
            </div>
          </section>
        </div>

        <div className="wl-pick-mobile">
          <section
            className={`wl21-featm reveal${status.label == null ? ' wl21-featm--nostamp' : ''}`}
          >
            <StatusBadge label={status.label} variant="mobile" />
            <span className="wl21-featm__eyebrow">{eyebrow}</span>
            <div className="wl21-goalm__book">
              {coverUrl != null ? <img src={coverUrl} alt="" /> : null}
            </div>
            <h2 className="wl21-featm__title">{title}</h2>
            <p className="wl21-featm__author">{author}</p>
            <p className="wl21-featm__msg">{message}</p>
            <div className="wl21-featm__price">
              <b>{formatMoney({ amount: price, currency })}</b>
              {prevPrice != null && prevPrice > price ? (
                <s>{formatMoney({ amount: prevPrice, currency })}</s>
              ) : null}
            </div>
            <span className="wl21-goalm__store">{props.storeDisplayName}</span>
            <AdaptiveBuyCta price={price} currency={currency} href={ctaHref} />
            <Link className="wl21-featm__details" href={detailsHref}>
              Деталі книги
            </Link>
          </section>
        </div>
    </div>
  );
}
