import type { CollectionDto } from '@/lib/api/types';
import { knBookWord } from '@/lib/format';
import { DynIcon } from './icons';
import { SecHead } from './SecHead';

export interface GenreGridProps {
  readonly genres: readonly CollectionDto[];
}

/**
 * «За жанром» — navigation grid of the top-8 popular genres (frozen §6 item 5,
 * rebuilt per the spec description: the canonical jsx dropped the section but
 * the frozen CLAUDE.md keeps it; the `.genre-card` recipe comes from the
 * source CSS). Links open the shared Collection Details template at
 * `/zhanry/:slug`. No see-all link: the grid already shows every published genre.
 */
export function GenreGrid({ genres }: GenreGridProps): React.JSX.Element | null {
  if (genres.length === 0) return null;
  return (
    <section className="sec reveal" id="zhanry">
      <SecHead
        eyebrow="Навігація"
        title="За жанром"
        sub="Оберіть жанр — і дивіться всі книги з цінами у книгарнях."
      />
      <div className="genre-grid">
        {genres.slice(0, 8).map((g) => (
          <a key={g.slug} href={`/zhanry/${g.slug}`} className="genre-card">
            <span className="genre-card__icon">
              <DynIcon name={g.icon ?? 'book-open'} size={20} />
            </span>
            <div className="genre-card__body">
              <div className="genre-card__name">{g.name}</div>
              <div className="genre-card__count">
                {g.bookCount} {knBookWord(g.bookCount)}
              </div>
            </div>
            <span className="genre-card__arrow">
              <DynIcon name="chevron-right" size={16} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
