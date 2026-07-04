import type { CollectionDto } from '@/lib/api/types';
import { knBookWord } from '@/lib/format';
import { DynIcon } from './icons';

export interface FeaturedCardProps {
  readonly collection: CollectionDto;
}

/**
 * FROZEN v1.0 «Книговик радить» featured hero band (DO NOT REDESIGN). Fixed
 * band colors (`#f2dbc1` light / `#070606` dark — NOT DS tokens) and the two
 * protected mascot files are wired in CSS; the mascot swaps by theme via the
 * `feat-mascot--light/--dark` classes so the hero stays a Server Component.
 */
export function FeaturedCard({ collection }: FeaturedCardProps): React.JSX.Element {
  return (
    <a href={`/dobirky/${collection.slug}`} className="feat-card">
      <img
        className="feat-mascot feat-mascot--light"
        src="/mascot/mascot-reading-chair-light-hybrid.png"
        alt="Книговик"
      />
      <img
        className="feat-mascot feat-mascot--dark"
        src="/mascot/mascot-reading-chair-dark-final.png"
        alt="Книговик"
      />
      <div className="feat-body">
        <div className="feat-badge">Книговик радить</div>
        <div className="feat-title">{collection.name}</div>
        <div className="feat-desc">{collection.description}</div>
      </div>
      <div className="feat-meta">
        <div className="feat-count-block">
          <div className="feat-count">
            <span className="feat-count-num">{collection.bookCount}</span>
            <span className="feat-count-unit">{knBookWord(collection.bookCount)}</span>
          </div>
          <div className="feat-count-lbl">у добірці</div>
        </div>
        <div className="feat-cta">
          Переглянути <DynIcon name="arrow-right" size={16} />
        </div>
      </div>
    </a>
  );
}
