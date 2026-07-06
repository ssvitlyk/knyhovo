import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  CollectionsError,
  getCollection,
  getCollectionBooks,
  listCollections,
} from '@/lib/api/collections';
import type { CollectionBooksPageDto, CollectionDto } from '@/lib/api/types';
import { detailsBadgeFor } from '@/lib/collections/badges';
import { collectionPath } from '@/lib/collections/labels';
import { kindFor, resolveUiSort, sortConfigFor, toApiSort, type UiSort } from '@/lib/collections/sort';
import {
  buildBreadcrumbJsonLd,
  buildCollectionMetaDescription,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
} from '@/lib/seo/collections-jsonld';
import { Breadcrumb } from './Breadcrumb';
import { InfoHeader } from './InfoHeader';
import { SortBar } from './SortBar';
import { BooksGrid, BooksGridRetry, type GridItem } from './BooksGrid';
import { CollectionsPagination } from './CollectionsPagination';
import { SimilarCollections, type SimilarItem } from './SimilarCollections';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const SIMILAR_COUNT = 3;
const SIMILAR_COVERS = 5;

export type CollectionBase = 'dobirky' | 'zhanry';

export interface DetailsSearchParams {
  readonly sort?: string;
  readonly page?: string;
}

/**
 * Resolve the collection for a details route, applying the canonical-URL
 * rules: unknown slug → 404; thin genre → hub; a taxonomic collection lives
 * under /zhanry and everything else under /dobirky (wrong base → redirect).
 */
async function resolveCollection(slug: string, base: CollectionBase): Promise<CollectionDto> {
  let result: Awaited<ReturnType<typeof getCollection>>;
  try {
    result = await getCollection(slug);
  } catch (error) {
    if (error instanceof CollectionsError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
  if ('redirectedToHub' in result) redirect('/dobirky');
  const { collection } = result;

  const canonicalBase: CollectionBase = collection.type === 'taxonomic' ? 'zhanry' : 'dobirky';
  if (canonicalBase !== base) redirect(`/${canonicalBase}/${collection.slug}`);
  return collection;
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Shared `generateMetadata` implementation for both details routes. */
export async function buildDetailsMetadata(slug: string, base: CollectionBase): Promise<Metadata> {
  let collection: CollectionDto;
  try {
    const result = await getCollection(slug);
    if ('redirectedToHub' in result) return { title: 'Добірки книг · Knyhovo' };
    collection = result.collection;
  } catch {
    return { title: 'Добірка · Knyhovo' };
  }
  const description = buildCollectionMetaDescription(collection);
  return {
    metadataBase: new URL(SITE_URL),
    title: `${collection.name} · Порівняти ціни · Knyhovo`,
    description,
    alternates: {
      canonical: `/${base}/${collection.slug}`,
      languages: { uk: `/${base}/${collection.slug}` },
    },
  };
}

/** Related collections per PRD FR-DET-08: same type first, then the rest. */
async function loadSimilar(current: CollectionDto): Promise<SimilarItem[]> {
  let all: readonly CollectionDto[];
  try {
    all = (await listCollections()).collections;
  } catch {
    return [];
  }

  const eligible = all.filter(
    (c) => c.slug !== current.slug && c.slug !== 'knyhovyk-radyt' && c.isActive && c.bookCount > 0,
  );
  const sameType = eligible.filter((c) => c.type === current.type);
  const rest = eligible.filter((c) => c.type !== current.type);
  const picked = [...sameType, ...rest].slice(0, SIMILAR_COUNT);

  const withCovers = await Promise.allSettled(
    picked.map(async (collection): Promise<SimilarItem> => {
      const { books } = await getCollectionBooks({ slug: collection.slug, page: 1 });
      return {
        collection,
        covers: books.slice(0, SIMILAR_COVERS).map((b) => ({ url: b.coverUrl, title: b.title })),
      };
    }),
  );
  return withCovers
    .filter((r): r is PromiseFulfilledResult<SimilarItem> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export interface CollectionDetailsPageProps {
  readonly slug: string;
  readonly base: CollectionBase;
  readonly searchParams: DetailsSearchParams;
}

/**
 * The single reusable Collection Details template (frozen §7) shared by
 * `/dobirky/[slug]` and `/zhanry/[slug]`: breadcrumb → compact head → sticky
 * sort bar → paginated book grid → «Схожі добірки». The URL is the single
 * source of truth for sort/page. A books-fetch failure degrades to a local
 * retry block — breadcrumb/head/footer stay rendered.
 */
export async function CollectionDetailsPage({
  slug,
  base,
  searchParams,
}: CollectionDetailsPageProps): Promise<React.JSX.Element> {
  const collection = await resolveCollection(slug, base);
  const cookie = (await cookies()).toString();

  const kind = kindFor(collection);
  const cfg = sortConfigFor(kind);
  const sort: UiSort = resolveUiSort(kind, searchParams.sort);
  const page = parsePage(searchParams.page);

  let booksPage: CollectionBooksPageDto | null = null;
  try {
    booksPage = await getCollectionBooks({ slug: collection.slug, page, sort: toApiSort(sort), cookie });
  } catch {
    booksPage = null; // degraded: grid-local retry below
  }

  const now = new Date();
  const items: GridItem[] =
    booksPage?.books.map((book) => ({ book, badge: detailsBadgeFor(book, now) })) ?? [];

  const similar = await loadSimilar(collection);

  const path = collectionPath(collection);
  const jsonLd: Record<string, unknown>[] = [
    buildCollectionPageJsonLd(SITE_URL, path, collection.name, collection.description),
    buildBreadcrumbJsonLd(SITE_URL, [
      { name: 'Головна', path: '/' },
      { name: 'Добірки', path: '/dobirky' },
      { name: collection.name, path },
    ]),
  ];
  if (booksPage !== null && page === 1) {
    jsonLd.push(buildItemListJsonLd(SITE_URL, collection, booksPage.books));
  }

  return (
    <main className="dobirky-scope">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumb title={collection.name} />
      <InfoHeader
        key={collection.slug}
        title={collection.name}
        description={collection.description}
        count={collection.bookCount}
      />
      <SortBar sort={sort} options={cfg.options} />
      <div className="cd-grid-wrap reveal">
        {booksPage === null ? <BooksGridRetry /> : <BooksGrid items={items} />}
      </div>
      {booksPage !== null ? (
        <CollectionsPagination basePath={path} sort={sort} page={booksPage.page} totalPages={booksPage.total_pages} />
      ) : null}
      <SimilarCollections items={similar} />
    </main>
  );
}
