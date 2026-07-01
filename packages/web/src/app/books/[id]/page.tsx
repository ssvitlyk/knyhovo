import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { BookDetailsError } from '@/lib/api/book';
import { getBookDetailsCached } from '@/lib/api/book-cache';
import { getBookAlertContext } from '@/lib/api/wishlist';
import { getAuthorShelfRoster } from '@/lib/author-shelf/roster';
import { buildBookJsonLd, buildBookMetaDescription } from '@/lib/seo/book-jsonld';
import type { BookDetailsDto } from '@/lib/api/types';
import { BookDetails } from '@/components/book/BookDetails';
import { PriceHistorySection } from '@/components/book/price-history/PriceHistorySection';
import { AuthorShelf } from '@/components/book/author-shelf/AuthorShelf';

/** Public site URL (absolute) — configurable; used for canonical + JSON-LD. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

interface BookPageProps {
  readonly params: Promise<{ id: string }>;
}

/**
 * Per-book SEO. Fetches the book (deduped with the page render via `cache()`);
 * on any failure returns a safe minimal metadata object — the page component
 * then triggers the not-found / error boundary. Unique title/description +
 * canonical + OpenGraph/Twitter per book.
 */
export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { id } = await params;

  let book: BookDetailsDto;
  try {
    book = await getBookDetailsCached(id);
  } catch {
    return { title: 'Книга — Knyhovo' };
  }

  const description = buildBookMetaDescription(book);
  const heading = `${book.title} — ${book.author}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${heading} · Knyhovo`,
    description,
    alternates: { canonical: `/books/${book.id}` },
    openGraph: {
      title: heading,
      description,
      url: `/books/${book.id}`,
      siteName: 'Knyhovo',
      locale: 'uk_UA',
      type: 'book',
      ...(book.coverUrl ? { images: [book.coverUrl] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: heading,
      description,
    },
  };
}

/**
 * Book details page — server component. Fetches the book from the API and
 * renders the two-column details layout. 404/400 responses trigger the
 * Next.js not-found boundary; other errors propagate to the error boundary.
 * Wishlist status is fetched in parallel; degrades gracefully to `false`
 * on auth or network failures (see getWishlistStatus contract).
 */
export default async function BookPage({ params }: BookPageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  let book: BookDetailsDto;
  try {
    book = await getBookDetailsCached(id);
  } catch (error) {
    if (error instanceof BookDetailsError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const cookie = (await cookies()).toString();
  const [ctx, authorRoster] = await Promise.all([
    getBookAlertContext({ bookId: id, cookie }),
    getAuthorShelfRoster(book.author),
  ]);

  return (
    <main className="results bd-main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBookJsonLd(book, SITE_URL)) }}
      />
      <p className="results__eyebrow">КНИГА · ПОРІВНЯННЯ ЦІН</p>
      <nav className="bd-crumbs">
        <a href="/search">Пошук</a> / <span>{book.title}</span>
      </nav>
      <BookDetails book={book} initialInWishlist={ctx.inWishlist} initialAlert={ctx.alert} />
      <PriceHistorySection bookId={id} />
      <AuthorShelf currentId={book.id} author={book.author} roster={authorRoster} />
    </main>
  );
}
