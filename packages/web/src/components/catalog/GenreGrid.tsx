import { SectionHead } from './SectionHead';
import { GenreCard } from './GenreCard';
import { GENRES, searchHref } from './content';

/**
 * «За жанром» — genre navigation grid (`.genre-grid`), ported 1:1 from the
 * frozen `Collections Landing Page`. Empty array → the whole section is hidden.
 */
export function GenreGrid(): React.JSX.Element | null {
  if (GENRES.length === 0) return null;
  return (
    <section className="genre-section">
      <SectionHead eyebrow="Навігація" title="За жанром" allLabel="Усі жанри →" allHref={searchHref('жанри')} />
      <div className="genre-grid">
        {GENRES.map((genre) => (
          <GenreCard key={genre.slug} genre={genre} />
        ))}
      </div>
    </section>
  );
}
