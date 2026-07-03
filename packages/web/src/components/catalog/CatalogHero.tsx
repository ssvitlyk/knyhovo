import { GENRES, DYNAMIC_COLLECTIONS } from './content';
import { formatCount } from './format';

/**
 * Catalog v1.0 hero — ported 1:1 from the frozen `Collections Landing Page`
 * (`.col-hero`). Server Component, static (no SearchBar per the frozen design).
 * The eyebrow shows the summed curated book count across genres + dynamic
 * collections, mirroring the frozen mock.
 */
export function CatalogHero(): React.JSX.Element {
  const total =
    GENRES.reduce((a, g) => a + g.count, 0) +
    DYNAMIC_COLLECTIONS.reduce((a, d) => a + d.count, 0);

  return (
    <section className="col-hero">
      <p className="col-hero__eye">Добірки · {formatCount(total)} книг · Щодня оновлюється</p>
      <h1 className="col-hero__title">
        Де знайти найкращу книгу?
        <br />
        <em className="kn-accent-serif">Knyhovo знає.</em>
      </h1>
      <p className="col-hero__sub">
        Кожна добірка — це найдешевші ціни з 5 книгарень, відібрані за якістю, жанром або моментом.
      </p>
    </section>
  );
}
