import type { Metadata } from 'next';
import { Hero } from '@/components/home/Hero';
import { Shelf } from '@/components/home/Shelf';
import { RecommendsShelf } from '@/components/home/RecommendsShelf';
import { getHomeShelves } from '@/components/home/data';
import type { HomeShelfView } from '@/components/home/data';

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
 * Presentation config per shelf key. The backend (`GET /api/home`) returns only
 * `key + books` in display order — all title/eyebrow/CTA/component choices live
 * here in the web, mapped by the opaque key. An unknown key renders nothing
 * (safe: a future backend shelf never crashes an older client).
 */
function renderShelf(shelf: HomeShelfView): React.JSX.Element | null {
  switch (shelf.key) {
    case 'popular':
      return (
        <Shelf
          key={shelf.key}
          eyebrow="Найчастіше шукають"
          title="Популярне зараз"
          lead="Книги, за якими читачі приходять до Knyhovo цього тижня."
          cta="Усі →"
          ctaHref="/dobirky/populyarne-zaraz"
          books={shelf.books}
        />
      );
    case 'novynky':
      return (
        <Shelf
          key={shelf.key}
          eyebrow="Щойно з друку"
          title="Новинки"
          cta="Весь каталог →"
          ctaHref="/dobirky/novynky"
          tint
          books={shelf.books}
        />
      );
    case 'knyhovyk':
      return <RecommendsShelf key={shelf.key} books={shelf.books} ctaHref="/dobirky/knyhovyk-radyt" />;
    default:
      return null;
  }
}

/**
 * Home page v1.0 — search-first landing (Concept A · Oracle Search). Server
 * Component: only `Hero` is a client island. The discovery shelves come from a
 * SINGLE composed endpoint (`GET /api/home`, via `getHomeShelves`) — the
 * backend owns cross-section dedup + provider diversity + display order. The
 * frozen Homepage v1.0 order (spec §6) is the backend display order: Популярне
 * зараз → Новинки → Knyhovo радить. Each shelf CTA links to its backing
 * `/dobirky/:slug`. Empty shelves are omitted; a full endpoint failure degrades
 * to the hero only.
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const shelves = await getHomeShelves();
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <Hero />
      {shelves.map(renderShelf)}
    </main>
  );
}
