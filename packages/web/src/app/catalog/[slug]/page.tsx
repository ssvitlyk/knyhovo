import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCollection, getCollectionBooks, getSimilarCollections, CollectionsError } from '@/lib/api/collections';
import { Breadcrumb } from '@/components/collections/Breadcrumb';
import { InfoHeader } from '@/components/collections/InfoHeader';
import { SortBar } from '@/components/collections/SortBar';
import { CollectionPagination } from '@/components/collections/CollectionPagination';
import { SimilarCollections } from '@/components/collections/SimilarCollections';
import { CollectionBookCard } from '@/components/collections/CollectionBookCard';
import { badgeFor, bestPriceIdOf, type BadgeKind } from '@/components/collections/badges';
import { collectionPath } from '@/lib/collectionsPaths';
import { SORT_OPTIONS, type CollectionSort } from '@/components/collections/sortOptions';
import type { CollectionBooksPageDto, CollectionsSimilarDto } from '@/lib/api/types';

/** Same badge vocabulary as the /catalog shelves for the 4 dynamic feeds;
 *  every other collection (genre/mood/editorial/curated/featured) defaults to
 *  best-price/discount — the general-purpose Homepage badge for a plain list. */
const DYNAMIC_BADGE_KIND: Readonly<Record<string, BadgeKind>> = {
  'najbilsh-bazhani': 'wishlist-count',
  'populyarne-zaraz': 'trending',
  novynky: 'new',
  znyzhky: 'discount',
};

function badgeKindFor(slug: string): BadgeKind {
  return DYNAMIC_BADGE_KIND[slug] ?? 'discount';
}

// Auth-aware (wishlist state) + always-fresh catalog data — never statically cached.
export const dynamic = 'force-dynamic';

interface CollectionDetailPageProps {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function parsePage(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseSort(value: string): CollectionSort {
  return (SORT_OPTIONS as readonly string[]).includes(value) ? (value as CollectionSort) : 'relevance';
}

export default async function CollectionDetailPage({
  params,
  searchParams,
}: CollectionDetailPageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const sp = await searchParams;
  const page = parsePage(firstParam(sp['page']));
  const sort = parseSort(firstParam(sp['sort']));
  const cookie = (await cookies()).toString();

  const collection = await getCollection(slug, { cookie });
  if ('notFound' in collection) notFound();

  let booksPage: CollectionBooksPageDto | null = null;
  let similar: CollectionsSimilarDto | null = null;
  let loadError: string | null = null;
  try {
    const [booksResult, similarResult] = await Promise.all([
      getCollectionBooks(slug, { page, sort, cookie }),
      getSimilarCollections(slug, { cookie }),
    ]);
    if ('notFound' in booksResult) notFound();
    booksPage = booksResult;
    similar = similarResult;
  } catch (error) {
    loadError = error instanceof CollectionsError ? error.message : 'Не вдалося завантажити добірку.';
  }

  return (
    <main>
      <div className="page">
        <Breadcrumb title={collection.title} />
        <InfoHeader title={collection.title} description={collection.description} count={collection.bookCount} />
      </div>

      <SortBar slug={slug} sort={sort} />

      <div className="page">
        <div className="cd-grid-wrap">
          {booksPage === null ? (
            <div className="cd-empty">
              {loadError ?? 'Не вдалося завантажити книги добірки.'}
            </div>
          ) : booksPage.books.length > 0 ? (
            <div className="cd-grid">
              {(() => {
                const badgeKind = badgeKindFor(slug);
                const bestPriceId = badgeKind === 'discount' ? bestPriceIdOf(booksPage.books) : undefined;
                return booksPage.books.map((book) => (
                  <CollectionBookCard
                    key={book.id}
                    book={book}
                    badge={badgeFor(book, badgeKind, { isBestPrice: book.id === bestPriceId })}
                    returnTo={collectionPath(slug)}
                  />
                ));
              })()}
            </div>
          ) : (
            <div className="cd-empty">У цій добірці поки немає книг.</div>
          )}
        </div>
        {booksPage ? (
          <CollectionPagination slug={slug} sort={sort} page={booksPage.page} totalPages={booksPage.totalPages} />
        ) : null}
      </div>

      {similar ? <SimilarCollections collections={similar.collections} /> : null}
    </main>
  );
}
