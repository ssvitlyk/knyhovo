import Link from 'next/link';
import type { Genre } from './content';
import { formatCount } from './format';

/**
 * Single genre navigation card (`.genre-card`) — emoji tile + name + curated
 * count, linking to the v1.0 search seam. Ported 1:1 from the frozen
 * `Collections Landing Page`.
 */
export function GenreCard({ genre }: { readonly genre: Genre }): React.JSX.Element {
  return (
    <Link href={genre.href} className="genre-card">
      <div className="genre-card__icon" aria-hidden="true">
        {genre.emoji}
      </div>
      <div className="genre-card__body">
        <div className="genre-card__name">{genre.name}</div>
        <div className="genre-card__count">{formatCount(genre.count)} книг</div>
      </div>
      <div className="genre-card__arrow" aria-hidden="true">
        ›
      </div>
    </Link>
  );
}
