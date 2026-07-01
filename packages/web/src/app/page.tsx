import type { Metadata } from 'next';
import { Hero } from '@/components/home/Hero';
import { Shelf } from '@/components/home/Shelf';
import { RecommendsShelf } from '@/components/home/RecommendsShelf';
import { POPULAR_NOW, NEW_RELEASES, RECOMMENDS } from '@/components/home/content';

/** Public site URL (absolute) — configurable; used for canonical + JSON-LD. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Canonical `/search` catalog target for every shelf CTA. */
const CATALOG_HREF = '/search';

const DESCRIPTION =
  'Порівнюйте ціни на паперові книги у 5+ книгарнях України. Пошук за назвою, ' +
  'автором або ISBN, відстеження цін і сповіщення про знижки.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Knyhovo — знайдіть найкращу ціну на книги',
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Knyhovo — знайдіть найкращу ціну на книги',
    description: DESCRIPTION,
    url: '/',
    siteName: 'Knyhovo',
    locale: 'uk_UA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Knyhovo — знайдіть найкращу ціну на книги',
    description: DESCRIPTION,
  },
};

// JSON-LD: WebSite + SearchAction (sitelinks searchbox) — the homepage is the
// product's search entry point, so we advertise the canonical /search?q= route.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Knyhovo',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

/**
 * Home page v1.0 — search-first landing (Concept A · Oracle Search). Server
 * Component: only `Hero` is a client island. Sections follow the frozen
 * Homepage v1.0 order (spec §6): Hero → Популярне зараз → Новинки → Knyhovo
 * радить. Shelves are fed by the curated static content module (clean seam for
 * a future API); an empty shelf hides its section.
 */
export default function HomePage(): React.JSX.Element {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <Hero />
      <Shelf
        eyebrow="Найчастіше шукають"
        title="Популярне зараз"
        lead="Книги, за якими читачі приходять до Knyhovo цього тижня."
        cta="Усі →"
        ctaHref={CATALOG_HREF}
        books={POPULAR_NOW}
      />
      <Shelf
        eyebrow="Щойно з друку"
        title="Новинки"
        cta="Весь каталог →"
        ctaHref={CATALOG_HREF}
        tint
        books={NEW_RELEASES}
      />
      <RecommendsShelf books={RECOMMENDS} ctaHref={CATALOG_HREF} />
    </main>
  );
}
