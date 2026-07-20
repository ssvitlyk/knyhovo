import Link from 'next/link';
import { AbIcon } from './icons';
import { VizWishlist, VizDetails, VizHistory, VizAlerts } from './vignettes';

interface FeatureCard {
  readonly title: string;
  readonly text: string;
  readonly Viz: () => React.JSX.Element;
  /** Visual CTA label (a plain span inside the card — the whole card is the link). */
  readonly cta: string;
  /** Destination for an authenticated visitor. */
  readonly href: string;
  /** When true, a guest is routed to `/login?returnTo=<href>` instead of `href`. */
  readonly authRequired?: boolean;
}

/**
 * «Можливості» (`about-app.jsx` AbFeatures) — 2+2 hierarchy, all cards equal
 * size; more important ones (Бажанки, Порівняння цін) come first. Every card is
 * one clickable destination: the whole `.ab-fcard` is a single `<Link>` and the
 * CTA text is a plain visual `<span>` (no nested anchors). Auth-aware cards
 * (Бажанки, Email-сповіщення) send guests through the app's login flow with a
 * validated `returnTo`, so a guest never lands on the wishlist auth-required
 * state just for being logged out.
 */
const AB_FEATURES: readonly FeatureCard[] = [
  {
    title: 'Бажанки',
    text: 'Список книг, за якими ми стежимо для вас.',
    Viz: VizWishlist,
    cta: 'Відкрити бажанки',
    href: '/wishlist',
    authRequired: true,
  },
  {
    title: 'Порівняння цін',
    text: 'Усі актуальні пропозиції книгарень в одному місці.',
    Viz: VizDetails,
    cta: 'Знайти книгу',
    href: '/search',
  },
  {
    title: 'Історія цін',
    text: 'Знайдіть книгу та подивіться, як змінювалася її ціна.',
    Viz: VizHistory,
    cta: 'Знайти книгу',
    href: '/search',
  },
  {
    title: 'Email-сповіщення',
    text: 'Лист саме тоді, коли варто купувати.',
    Viz: VizAlerts,
    cta: 'Налаштувати',
    href: '/settings/notifications',
    authRequired: true,
  },
];

export interface FeaturesProps {
  readonly authenticated: boolean;
}

/** Resolve a card's destination, gating auth-required cards behind login. */
function destinationFor(card: FeatureCard, authenticated: boolean): string {
  if (card.authRequired && !authenticated) {
    return `/login?returnTo=${encodeURIComponent(card.href)}`;
  }
  return card.href;
}

export function Features({ authenticated }: FeaturesProps): React.JSX.Element {
  return (
    <section className="ab-sec reveal">
      <div className="ab-sechead">
        <div className="ab-eyebrow">Можливості</div>
        <h2 className="ab-h2">Усе, щоб купувати книги вигідно</h2>
      </div>
      <div className="ab-feat__grid">
        {AB_FEATURES.map((f) => {
          const Viz = f.Viz;
          return (
            <Link className="ab-fcard" href={destinationFor(f, authenticated)} key={f.title}>
              <div className="ab-fcard__viz">
                <Viz />
              </div>
              <div className="ab-fcard__body">
                <h3 className="ab-fcard__title">{f.title}</h3>
                <p className="ab-fcard__text">{f.text}</p>
                <span className="ab-fcard__cta">
                  {f.cta}
                  <AbIcon name="arrowright" size={14} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
