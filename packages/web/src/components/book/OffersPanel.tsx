import { Badge } from '@/components/ds/Badge';
import { WishlistToggle } from './WishlistToggle';
import { StickyCta } from './StickyCta';
import { formatMoney, providerDisplayName } from '@/lib/format';
import { getBestOffer, getCheapestOffer, getOfferState, sortOffers } from '@/lib/offers';
import type { Availability } from '@knyhovo/shared';
import type { AlertDto, BookProviderDto, MoneyDto } from '@/lib/api/types';

export interface OffersPanelProps {
  readonly providers: readonly BookProviderDto[];
  readonly lowestPrice: MoneyDto | null;
  readonly offersCount: number;
  readonly bookId: string;
  readonly initialInWishlist: boolean;
  readonly initialAlert: AlertDto | null;
  readonly bookTitle: string;
}

const UKRAINIAN_MONTHS = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
] as const;

interface AvailLabel {
  readonly label: string;
  readonly cls: string;
}

function availLabel(availability: Availability): AvailLabel {
  switch (availability) {
    case 'in-stock':
      return { label: 'В наявності', cls: 'in' };
    case 'out-of-stock':
      return { label: 'Немає в наявності', cls: 'out' };
    case 'unknown':
      return { label: 'Наявність уточнюється', cls: 'unknown' };
  }
}

/** Format the latest lastSeenAt date across providers as a deterministic Ukrainian string. */
function formatUpdatedNote(providers: readonly BookProviderDto[]): string {
  const latest = providers.reduce((max, p) => (p.lastSeenAt > max ? p.lastSeenAt : max), providers[0]!.lastSeenAt);
  // Slice the ISO date part YYYY-MM-DD deterministically — no Date.now(), no locale
  const datePart = latest.slice(0, 10); // "YYYY-MM-DD"
  const year = datePart.slice(0, 4);
  const monthIndex = Number.parseInt(datePart.slice(5, 7), 10) - 1;
  const day = Number.parseInt(datePart.slice(8, 10), 10);
  const monthName = UKRAINIAN_MONTHS[monthIndex] ?? '';
  return `Ціни оновлено: ${day} ${monthName} ${year}`;
}

/**
 * Build the «why this offer» list for the best block. W6a-safe only — every
 * reason is derived from `price` + `availability` (no delivery, reliability,
 * per-offer freshness or discount data). An out-of-stock best (all offers OOS)
 * never claims availability.
 */
function buildBestReasons(best: BookProviderDto, providers: readonly BookProviderDto[]): string[] {
  const reasons: string[] = [];
  const bestAvailable = best.availability !== 'out-of-stock';
  const availableCount = providers.filter((p) => p.availability !== 'out-of-stock').length;

  if (bestAvailable && availableCount > 1) {
    reasons.push('Найдешевша серед наявних');
  }
  if (best.availability === 'in-stock') {
    reasons.push('В наявності зараз');
  } else if (best.availability === 'unknown') {
    reasons.push('Наявність уточнюється');
  }
  if (bestAvailable) {
    const next = sortOffers(providers).find(
      (p) => p.availability !== 'out-of-stock' && p.price.amount > best.price.amount,
    );
    if (next) {
      const diff = next.price.amount - best.price.amount;
      reasons.push(
        `На ${formatMoney({ amount: diff, currency: best.price.currency })} дешевше за наступну книгарню`,
      );
    }
  }
  return reasons;
}

/**
 * OffersPanel — sticky right-column card with the best price block and
 * per-provider comparison rows. When no offers are available shows the
 * "unavailable" mascot state instead.
 */
export function OffersPanel({
  providers,
  lowestPrice: _lowestPrice,
  offersCount,
  bookId,
  initialInWishlist,
  initialAlert,
  bookTitle,
}: OffersPanelProps): React.JSX.Element {
  if (providers.length === 0) {
    return (
      <aside className="bdc-panel">
        <div className="bd-unavail">
          <img className="bd-unavail__mascot bd-unavail__mascot--light" src="/mascot/mascot-magnifier.png" alt="" />
          <img className="bd-unavail__mascot bd-unavail__mascot--dark" src="/mascot/mascot-lantern.png" alt="" />
          <h2 className="bd-unavail__title">Зараз немає в наявності</h2>
          <p className="bd-unavail__text">
            Наразі жодна книгарня не має цієї книги в наявності. Загляньте пізніше — ми оновлюємо ціни щодня.
          </p>
          <p className="bd-unavail__hint">
            {'Додайте у вішлист — ми повідомимо, щойно книга з\'явиться.'}
          </p>
        </div>
        <WishlistToggle
          bookId={bookId}
          initialInWishlist={initialInWishlist}
          initialAlert={initialAlert}
          currentPrice={null}
          bookTitle={bookTitle}
        />
      </aside>
    );
  }

  // W6a — derive best offer, ordering and panel state fully client-side.
  const best = getBestOffer(providers)!;
  const cheapest = getCheapestOffer(providers)!;
  const state = getOfferState(providers);
  const rest = sortOffers(providers).filter((o) => o !== best);
  const bestLabel = availLabel(best.availability);
  const updatedNote = formatUpdatedNote(providers);

  const bestBadge = state === 'cheapest-but-oos' ? 'Найкращий вибір' : 'Найкраща ціна';
  const bestNote =
    state === 'cheapest-but-oos'
      ? `Найдешевша ціна — ${formatMoney(cheapest.price)} у ${providerDisplayName(cheapest.provider)}, але книги зараз немає в наявності.`
      : null;
  const reasons = buildBestReasons(best, providers);

  return (
    <aside className="bdc-panel">
      <p className="bd-eyebrow" style={{ marginBottom: 0 }}>
        {`ЦІНИ У ${offersCount} КНИГАРНЯХ`}
      </p>
      <div className="bdc-best" id="bd-best-block">
        <Badge tone="green">{bestBadge}</Badge>
        <div className="bdc-best__pricerow">
          <span className="bdc-best__price">{formatMoney(best.price)}</span>
        </div>
        <p className="bdc-best__store">
          {'у '}
          <b>{providerDisplayName(best.provider)}</b>
          {' · '}
          <span className={`bd-offer__avail--${bestLabel.cls}`}>{bestLabel.label}</span>
        </p>
        {reasons.length > 0 ? (
          <ul
            className="bdc-best__reasons"
            style={{
              listStyle: 'none',
              margin: '0 0 var(--space-4)',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-1)',
            }}
          >
            {reasons.map((reason) => (
              <li
                key={reason}
                style={{
                  display: 'flex',
                  gap: 'var(--space-2)',
                  alignItems: 'baseline',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text-body)',
                }}
              >
                <span aria-hidden="true" style={{ color: 'var(--brand-green)', fontWeight: 'var(--fw-semibold)' }}>
                  ✓
                </span>
                {reason}
              </li>
            ))}
          </ul>
        ) : null}
        {bestNote ? (
          <p className="bd-hint" style={{ marginBottom: 'var(--space-4)' }}>
            {bestNote}
          </p>
        ) : null}
        <a
          className="kn-btn kn-btn--primary"
          style={{ width: '100%' }}
          href={best.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Перейти до книгарні
        </a>
        <WishlistToggle
          bookId={bookId}
          initialInWishlist={initialInWishlist}
          initialAlert={initialAlert}
          currentPrice={best.price}
          bookTitle={bookTitle}
          store={providerDisplayName(best.provider)}
        />
      </div>
      <div>
        {rest.map((o) => {
          const oLabel = availLabel(o.availability);
          const isOut = o.availability === 'out-of-stock';
          let rowBadge: React.JSX.Element | null = null;
          if (state === 'cheapest-but-oos' && o === cheapest) {
            rowBadge = <Badge tone="neutral">Найдешевша</Badge>;
          } else if (state === 'same-price' && !isOut && o.price.amount === best.price.amount) {
            rowBadge = <Badge tone="neutral">Така сама ціна</Badge>;
          }
          return (
            <div className={`bdc-row${isOut ? ' bdc-row--out' : ''}`} key={o.provider + o.url}>
              <span className="bdc-row__store">
                {providerDisplayName(o.provider)}
                {rowBadge ? <span style={{ marginLeft: 'var(--space-2)' }}>{rowBadge}</span> : null}
              </span>
              <span className={`bdc-row__avail bd-offer__avail--${oLabel.cls}`}>{oLabel.label}</span>
              <span className="bdc-row__price">{formatMoney(o.price)}</span>
              <a
                className="kn-btn kn-btn--secondary kn-btn--sm"
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Перейти
              </a>
            </div>
          );
        })}
      </div>
      <p className="bd-updated">{updatedNote}</p>
      <StickyCta price={best.price} store={providerDisplayName(best.provider)} href={best.url} />
    </aside>
  );
}
