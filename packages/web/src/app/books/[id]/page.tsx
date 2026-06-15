import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getBookDetails, BookDetailsError } from '@/lib/api/book';
import { getWishlistStatus } from '@/lib/api/wishlist';
import type { BookDetailsDto } from '@/lib/api/types';
import { BookDetails } from '@/components/book/BookDetails';
import { PriceHistorySection } from '@/components/book/price-history/PriceHistorySection';

interface BookPageProps {
  readonly params: Promise<{ id: string }>;
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
    book = await getBookDetails(id);
  } catch (error) {
    if (error instanceof BookDetailsError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const cookie = (await cookies()).toString();
  const initialInWishlist = await getWishlistStatus({ bookId: id, cookie });

  return (
    <main className="results">
      <p className="results__eyebrow">КНИГА · ПОРІВНЯННЯ ЦІН</p>
      <nav className="bd-crumbs">
        <a href="/search">Пошук</a> / <span>{book.title}</span>
      </nav>
      <BookDetails book={book} initialInWishlist={initialInWishlist} />
      <PriceHistorySection bookId={id} />
    </main>
  );
}
