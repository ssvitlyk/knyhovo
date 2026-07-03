import Link from 'next/link';
import { SectionHead } from './SectionHead';
import { DYNAMIC_COLLECTIONS } from './content';
import { formatCount } from './format';

/**
 * «Актуальні добірки» — dynamic collection grid (`.dynamic-grid` / `.dyn-card`),
 * ported 1:1 from the frozen `Collections Landing Page`. Counts are a curated
 * static seed in v1.0; each card links to the search seam. Empty array → the
 * whole section is hidden.
 */
export function DynamicCollections(): React.JSX.Element | null {
  if (DYNAMIC_COLLECTIONS.length === 0) return null;
  return (
    <section className="dynamic-section">
      <SectionHead eyebrow="Актуальні добірки" title="Щодня оновлюється" />
      <div className="dynamic-grid">
        {DYNAMIC_COLLECTIONS.map((col) => (
          <Link key={col.slug} href={col.href} className="dyn-card">
            <div className="dyn-card__icon" style={{ background: col.iconBg }}>
              <span className="dyn-card__glyph">{col.icon}</span>
            </div>
            <div className="dyn-card__name">{col.name}</div>
            <div className="dyn-card__meta">{col.desc}</div>
            <div>
              <div className="dyn-card__count">{formatCount(col.count)}</div>
              <div className="dyn-card__count-lbl">книг зараз</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
