import { apiBaseUrl } from './env';
import { apiJson, defineApiError } from './http';
import type { BookDetailsDto } from './types';

/** Error thrown when the book-details request fails (network, timeout, or non-2xx). */
export class BookDetailsError extends defineApiError('BookDetailsError') {}

/**
 * Call `GET /api/books/:id` (S7a). Runs server-side (Server Component / route),
 * so the absolute backend URL is hit directly — no CORS. The request carries an
 * explicit timeout (security rule: external HTTP must time out, no hidden
 * retries). Throws {@link BookDetailsError} on transport, timeout, or non-2xx.
 */
export async function getBookDetails(id: string): Promise<BookDetailsDto> {
  return apiJson<BookDetailsDto>(`${apiBaseUrl()}/api/books/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    errorClass: BookDetailsError,
    transportMessage: 'Не вдалося звʼязатися з сервісом книг.',
    httpMessage: (status) => `Сервіс книг повернув помилку (${status}).`,
  });
}
