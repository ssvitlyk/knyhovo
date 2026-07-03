import Link from 'next/link';
import { CollectionIcon } from './icons';
import type { CollectionSummaryDto } from '@/lib/api/types';

export interface FeaturedCardProps {
  readonly featured: CollectionSummaryDto;
}

/**
 * FROZEN v1.0 — «Книговик радить» featured block. Pixel-identical recipe
 * (232px height, radial-mask mascot, 3-line clamp desc, mobile single row) —
 * see design-import/incoming/CLAUDE.md. Uses the frozen reading-chair mascot
 * pair, theme-swapped via CSS (light-hybrid / dark-final).
 */
export function FeaturedCard({ featured }: FeaturedCardProps): React.JSX.Element {
  return (
    <Link href={`/catalog/${featured.slug}`} className="feat-card">
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
        <div className="feat-title">{featured.title}</div>
        {featured.description ? <div className="feat-desc">{featured.description}</div> : null}
      </div>
      <div className="feat-meta">
        <div className="feat-count-block">
          <div className="feat-count">
            <span className="feat-count-num">{featured.bookCount}</span>
            <span className="feat-count-unit">книг</span>
          </div>
          <div className="feat-count-lbl">у добірці</div>
        </div>
        <div className="feat-cta">
          Переглянути <CollectionIcon name="arrow-right" size={16} />
        </div>
      </div>
    </Link>
  );
}
