import { apiBaseUrl } from './env';
import { apiJson, defineApiError, type ApiRequestOptions } from './http';
import type { BookPriceHistoryDto, PriceHistoryPeriod } from './types';

/** Error thrown when a price-history request fails (network, timeout, or non-2xx). */
export class PriceHistoryError extends defineApiError('PriceHistoryError') {}

function fetchPriceHistory(
  origin: string,
  bookId: string,
  apiPeriod: PriceHistoryPeriod,
  options: Pick<ApiRequestOptions, 'cache' | 'credentials'>,
): Promise<BookPriceHistoryDto> {
  return apiJson<BookPriceHistoryDto>(
    `${origin}/api/books/${encodeURIComponent(bookId)}/price-history?period=${apiPeriod}`,
    {
      ...options,
      errorClass: PriceHistoryError,
      transportMessage: 'Не вдалося завантажити динаміку цін.',
      httpMessage: (status) => `Не вдалося завантажити динаміку цін (${status}).`,
    },
  );
}

/**
 * Fetch the price history for a canonical book.
 * Runs browser-side — uses a relative URL so the Next.js `/api/*` rewrite
 * proxies the request to the Fastify API. Uses AbortController + 8s timeout,
 * mirrors the addToWishlist fetch pattern.
 */
export async function getPriceHistory(
  bookId: string,
  apiPeriod: PriceHistoryPeriod,
): Promise<BookPriceHistoryDto> {
  return fetchPriceHistory('', bookId, apiPeriod, { credentials: 'include' });
}

/**
 * Fetch the price history for a canonical book — server-side variant for the
 * wishlist v2.2 «Порада Книговика» section. Uses the absolute backend origin
 * (`apiBaseUrl()`) instead of the Next.js `/api/*` rewrite, same DTO and 8s
 * timeout as {@link getPriceHistory}. Callers are expected to
 * `.catch(() => null)` — the pick section degrades to hidden.
 */
export async function getPriceHistoryServer(
  bookId: string,
  apiPeriod: PriceHistoryPeriod,
): Promise<BookPriceHistoryDto> {
  return fetchPriceHistory(apiBaseUrl(), bookId, apiPeriod, { cache: 'no-store' });
}
