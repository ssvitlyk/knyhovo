import Link from 'next/link';
import { SectionHead } from './SectionHead';
import { EDITORIAL } from './content';
import { formatCount } from './format';

/**
 * «Curated» — editorial spotlight grid (`.editorial-grid` / `.ed-card`), ported
 * 1:1 from the frozen `Collections Landing Page`. Cards carry either the
 * Книговик avatar image (reused DS asset) or a glyph. Empty array → the whole
 * section is hidden.
 */
export function EditorialSpotlight(): React.JSX.Element | null {
  if (EDITORIAL.length === 0) return null;
  return (
    <section className="editorial-section">
      <SectionHead eyebrow="Редакційне" title="Curated" />
      <div className="editorial-grid">
        {EDITORIAL.map((ed) => (
          <Link key={ed.slug} href={ed.href} className="ed-card">
            <div className="ed-card__top">
              <div className="ed-card__avatar">
                {ed.avatar ? (
                  <img src={ed.avatar} alt="" />
                ) : (
                  <span className="ed-card__glyph" aria-hidden="true">
                    {ed.avatarLetter}
                  </span>
                )}
              </div>
              <div>
                <div className="ed-card__type">{ed.type}</div>
                <div className="ed-card__name">{ed.name}</div>
              </div>
            </div>
            <div className="ed-card__desc">{ed.desc}</div>
            <div className="ed-card__footer">
              <span className="ed-card__count">{formatCount(ed.count)} книг</span>
              <span className="ed-card__link">Переглянути →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
