import Link from 'next/link';
import { BookCover } from './BookCover';
import { FEATURED } from './content';
import { formatCount } from './format';

/**
 * Featured editorial card (`.feat-card`) — ported 1:1 from the frozen
 * `Collections Landing Page`. Fanned gradient cover stack + editorial copy +
 * curated count + «Переглянути →» action. The whole card is a link to the
 * v1.0 search seam ({@link FEATURED}.href).
 */
export function FeaturedCard(): React.JSX.Element {
  return (
    <Link href={FEATURED.href} className="feat-card">
      <div className="feat-covers">
        {FEATURED.coverSeeds.map((seed, i) => (
          <div key={seed} className="feat-cover" style={i === 0 ? { position: 'relative', zIndex: 2 } : undefined}>
            <BookCover seed={seed} />
          </div>
        ))}
      </div>
      <div className="feat-body">
        <div className="feat-badge">{FEATURED.badge}</div>
        <div className="feat-title">{FEATURED.title}</div>
        <div className="feat-desc">{FEATURED.desc}</div>
      </div>
      <div className="feat-meta">
        <div className="feat-count">{formatCount(FEATURED.count)}</div>
        <div className="feat-count-lbl">
          книг
          <br />у добірці
        </div>
        <span className="kn-btn kn-btn--primary kn-btn--sm feat-cta">Переглянути →</span>
      </div>
    </Link>
  );
}
