import Link from 'next/link';
import { SectionHead } from './SectionHead';
import { AUTHORS, searchHref } from './content';

/**
 * «Популярні автори» — author chip cloud (`.authors-cloud` / `.author-chip`),
 * ported 1:1 from the frozen `Collections Landing Page`. Each chip links to the
 * v1.0 search seam. Empty array → the whole section is hidden.
 */
export function PopularAuthors(): React.JSX.Element | null {
  if (AUTHORS.length === 0) return null;
  return (
    <section className="authors-section">
      <SectionHead
        eyebrow="Авторські добірки"
        title="Популярні автори"
        allLabel="Усі автори →"
        allHref={searchHref('автори')}
      />
      <div className="authors-cloud">
        {AUTHORS.map((a) => (
          <Link key={a.slug} href={a.href} className="author-chip">
            {a.name}
            <span className="author-chip__count">{a.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
