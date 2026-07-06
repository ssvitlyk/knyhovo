import type { Metadata } from 'next';
import { Hero } from '@/components/home/Hero';
import { Shelf } from '@/components/home/Shelf';
import { RecommendsShelf } from '@/components/home/RecommendsShelf';
import { getHomeShelves } from '@/components/home/data';

/** Public site URL (absolute) — configurable; used for canonical + JSON-LD. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

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
 * радить. Shelves are fed live from the collections API (`getHomeShelves`);
 * each shelf CTA links to its backing `/dobirky/:slug`. An empty shelf hides
 * its section.
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const { popular, newReleases, recommends } = await getHomeShelves();
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <Hero />
      <Shelf
        eyebrow="Найчастіше шукають"
        title="Популярне зараз"
        lead="Книги, за якими читачі приходять до Knyhovo цього тижня."
        cta="Усі →"
        ctaHref="/dobirky/populyarne-zaraz"
        books={popular}
      />
      <Shelf
        eyebrow="Щойно з друку"
        title="Новинки"
        cta="Весь каталог →"
        ctaHref="/dobirky/novynky"
        tint
        books={newReleases}
      />
      <RecommendsShelf books={recommends} ctaHref="/dobirky/knyhovyk-radyt" />
    </main>
  );
}
