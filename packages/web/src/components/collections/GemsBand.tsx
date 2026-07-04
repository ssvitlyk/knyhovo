import Link from 'next/link';
import { DynIcon } from './icons';

export interface GemsBandProps {
  /** First three cover URLs of the `pryhovani-skarby` collection. */
  readonly fanCovers: readonly string[];
}

/**
 * «Недооцінені книги» — hidden-gems editorial band (green-wash, fanned cover
 * trio), frozen §6 item 9: the final culmination, hidden below 1024px (CSS).
 * Copy is frozen editorial text from the mock; only the covers are live data.
 */
export function GemsBand({ fanCovers }: GemsBandProps): React.JSX.Element {
  return (
    <section className="sec reveal">
      <div className="gems-band">
        <div className="gems-band__body">
          <div className="gems-band__eyebrow">
            <span className="gems-band__dot" />
            Недооцінені книги
          </div>
          <h2 className="gems-band__title">Тихі книги, що варті гучної уваги</h2>
          <p className="gems-band__desc">
            Рейтинг 4.5+ і менш ніж 200 оцінок. Те, що ще не знайшло свого читача — але точно на нього чекає.
            Книговик відкладає такі окремо.
          </p>
          <Link className="gems-band__cta" href="/dobirky/pryhovani-skarby">
            Дослідити добірку <DynIcon name="arrow-right" size={18} />
          </Link>
        </div>
        <div className="gems-band__fan" aria-hidden="true">
          {fanCovers.slice(0, 3).map((cover, i) => (
            <img
              key={cover}
              className={`gems-fan__cover gems-fan__cover--${i}`}
              src={cover}
              alt=""
              loading="lazy"
              draggable="false"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
