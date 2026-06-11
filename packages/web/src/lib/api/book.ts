import type { BookDetailsDto } from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when the book-details request fails (network, timeout, or non-2xx). */
export class BookDetailsError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'BookDetailsError';
    this.status = status;
  }
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:3000';
}

/**
 * Call `GET /api/books/:id` (S7a). Runs server-side (Server Component / route),
 * so the absolute backend URL is hit directly — no CORS. The request carries an
 * explicit timeout (security rule: external HTTP must time out, no hidden
 * retries). Throws {@link BookDetailsError} on transport, timeout, or non-2xx.
 */
export async function getBookDetails(id: string): Promise<BookDetailsDto> {
  const url = `${apiBaseUrl()}/api/books/${encodeURIComponent(id)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } catch {
    throw new BookDetailsError('Не вдалося звʼязатися з сервісом книг.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new BookDetailsError(`Сервіс книг повернув помилку (${response.status}).`, response.status);
  }

  return (await response.json()) as BookDetailsDto;
}
