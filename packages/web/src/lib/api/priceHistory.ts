import { apiBaseUrl } from './env';
import type { BookPriceHistoryDto, PriceHistoryPeriod } from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when a price-history request fails (network, timeout, or non-2xx). */
export class PriceHistoryError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'PriceHistoryError';
    this.status = status;
  }
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `/api/books/${encodeURIComponent(bookId)}/price-history?period=${apiPeriod}`,
      {
        signal: controller.signal,
        credentials: 'include',
      },
    );
  } catch {
    throw new PriceHistoryError('Не вдалося завантажити динаміку цін.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new PriceHistoryError(
      `Не вдалося завантажити динаміку цін (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as BookPriceHistoryDto;
}

/**
 * Fetch the price history for a canonical book — server-side variant for the
 * wishlist v2.2 «Порада Книговика» section. Uses the absolute backend origin
 * (`apiBaseUrl()`) instead of the Next.js `/api/*` rewrite, same DTO and 8s
 * AbortController timeout pattern as {@link getPriceHistory}. Callers are
 * expected to `.catch(() => null)` — the pick section degrades to hidden.
 */
export async function getPriceHistoryServer(
  bookId: string,
  apiPeriod: PriceHistoryPeriod,
): Promise<BookPriceHistoryDto> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `${apiBaseUrl()}/api/books/${encodeURIComponent(bookId)}/price-history?period=${apiPeriod}`,
      {
        signal: controller.signal,
        cache: 'no-store',
      },
    );
  } catch {
    throw new PriceHistoryError('Не вдалося завантажити динаміку цін.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new PriceHistoryError(
      `Не вдалося завантажити динаміку цін (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as BookPriceHistoryDto;
}
