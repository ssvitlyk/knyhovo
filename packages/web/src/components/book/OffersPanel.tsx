import { Badge } from '@/components/ds/Badge';
import { WishlistToggle } from './WishlistToggle';
import { formatMoney, providerDisplayName } from '@/lib/format';
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

  const best = providers[0]!;
  const rest = providers.slice(1);
  const bestLabel = availLabel(best.availability);
  const updatedNote = formatUpdatedNote(providers);

  return (
    <aside className="bdc-panel">
      <p className="bd-eyebrow" style={{ marginBottom: 0 }}>
        {`ЦІНИ У ${offersCount} КНИГАРНЯХ`}
      </p>
      <div className="bdc-best">
        <Badge tone="green">Найкраща ціна</Badge>
        <div className="bdc-best__pricerow">
          <span className="bdc-best__price">{formatMoney(best.price)}</span>
        </div>
        <p className="bdc-best__store">
          {'у '}
          <b>{providerDisplayName(best.provider)}</b>
          {' · '}
          <span className={`bd-offer__avail--${bestLabel.cls}`}>{bestLabel.label}</span>
        </p>
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
          return (
            <div className="bdc-row" key={o.provider + o.url}>
              <span className="bdc-row__store">{providerDisplayName(o.provider)}</span>
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
    </aside>
  );
}
