'use client';

import { Chip } from '@/components/ds/Chip';
import { useSearchNavigation } from '@/components/search/useSearchCombobox';
import { HeroSearch } from './HeroSearch';
import { POPULAR_QUERIES } from './content';

/**
 * Homepage hero — approved 50/50 layout (Concept A · Oracle Search). The only
 * Client Component on `/`. The search field itself is {@link HeroSearch}, which
 * runs the shared live autocomplete; the "популярне" chips are plain entry
 * points and route through the same `useSearchNavigation` helper, so there is
 * one URL shape and one recents policy on this page too.
 * Книговик (mascot-hero) is theme-swapped via CSS with two `<img>` — the same
 * recipe as the site logo — so the hero needs no theme read in JS.
 */
export function Hero(): React.JSX.Element {
  const { goToSearch } = useSearchNavigation();

  return (
    <section className="hero">
      <div className="hero__text">
        <p className="kn-eyebrow">Знаходимо дешевше · Відстежуємо ціни · Сповіщаємо</p>
        <h1 className="hero__title">
          Де книга дешевша?
          <br />
          <em className="kn-accent-serif">Knyhovo знає.</em>
        </h1>
        <p className="hero__lead">Знаходьте бажане, порівнюйте ціни та купуйте вигідно.</p>
        <HeroSearch />
        <div className="hero__stats">
          <div className="stat">
            <span className="stat__num">5+</span>
            <span className="stat__label">книгарень</span>
          </div>
          <div className="stat">
            <span className="stat__num">12k+</span>
            <span className="stat__label">книг</span>
          </div>
          <div className="stat">
            <span className="stat__num">24/7</span>
            <span className="stat__label">відстеження цін</span>
          </div>
        </div>
        <div className="hero__popular">
          <span className="hero__popular-label">Популярне:</span>
          {POPULAR_QUERIES.map((c) => (
            <Chip key={c} onClick={() => goToSearch(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>
      <div className="hero__art">
        <img
          className="hero__mascot hero__mascot--light"
          src="/mascot/mascot-hero-light.png"
          alt="Книговик — книжковий провідник Knyhovo"
        />
        <img
          className="hero__mascot hero__mascot--dark"
          src="/mascot/mascot-hero-dark.png"
          alt="Книговик — книжковий провідник Knyhovo"
        />
      </div>
    </section>
  );
}
