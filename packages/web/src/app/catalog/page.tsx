import type { Metadata } from 'next';
import { CatalogHero } from '@/components/catalog/CatalogHero';
import { FeaturedCard } from '@/components/catalog/FeaturedCard';
import { DynamicCollections } from '@/components/catalog/DynamicCollections';
import { GenreGrid } from '@/components/catalog/GenreGrid';
import { EditorialSpotlight } from '@/components/catalog/EditorialSpotlight';
import { PopularAuthors } from '@/components/catalog/PopularAuthors';

/** Public site URL (absolute) — configurable; used for canonical + JSON-LD. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const TITLE = 'Каталог книг — жанри, автори та добірки | Knyhovo';
const DESCRIPTION =
  'Каталог Knyhovo: обирайте книги за жанром, автором чи кураторською добіркою ' +
  'та порівнюйте ціни у 5+ книгарнях України.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/catalog' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/catalog',
    siteName: 'Knyhovo',
    locale: 'uk_UA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

// JSON-LD: the catalog is a CollectionPage; a BreadcrumbList places it under
// the home page (Головна → Каталог) for richer SERP breadcrumbs.
const COLLECTION_LD = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Каталог книг',
  description: DESCRIPTION,
  url: `${SITE_URL}/catalog`,
  isPartOf: { '@type': 'WebSite', name: 'Knyhovo', url: SITE_URL },
};

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Каталог', item: `${SITE_URL}/catalog` },
  ],
};

/**
 * Catalog v1.0 — curated navigation landing (`/catalog`). Server Component only
 * (no client island): every card is a static `next/link` to the `/search?q=…`
 * seam. Sections follow the frozen `Collections Landing Page` order: Hero →
 * Featured → Актуальні добірки → [divider] → За жанром → [divider] → Curated →
 * Популярні автори. Fed by the curated static content module; an empty section
 * hides itself.
 */
export default function CatalogPage(): React.JSX.Element {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(COLLECTION_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }} />
      <CatalogHero />
      <FeaturedCard />
      <DynamicCollections />
      <hr className="page-divider" />
      <GenreGrid />
      <hr className="page-divider" />
      <EditorialSpotlight />
      <PopularAuthors />
    </main>
  );
}
