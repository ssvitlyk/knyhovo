import { apiBaseUrl } from './env';
import { apiRequest, defineApiError } from './http';
import type { AlertDto, BuyingOpportunitiesResponseDto, WishlistResponseDto } from './types';

/** Error thrown when a wishlist request fails (network, timeout, or non-2xx, except 401 sentinels). */
export class WishlistError extends defineApiError('WishlistError') {}

/** Server-side GET with the forwarded cookie; 401 is returned (not thrown) so callers can map it to a sentinel. */
async function getWithCookie(path: string, cookie: string): Promise<Response> {
  return apiRequest(`${apiBaseUrl()}${path}`, {
    cache: 'no-store',
    cookie,
    errorClass: WishlistError,
    transportMessage: 'Не вдалося звʼязатися з сервісом бажанок.',
    httpMessage: (status) => `Сервіс бажанок повернув помилку (${status}).`,
    passthrough: (status) => status === 401,
  });
}

/**
 * Fetch the authenticated user's wishlist (S9 `GET /api/wishlist`).
 * Runs server-side — hits the backend directly using the forwarded session
 * cookie. Returns `{ unauthorized: true }` sentinel on 401 so the page can
 * render a graceful auth-required state without throwing. Throws
 * {@link WishlistError} on other non-2xx or transport/timeout failures.
 */
export async function getWishlist({
  cookie,
}: {
  cookie: string;
}): Promise<WishlistResponseDto | { unauthorized: true }> {
  const response = await getWithCookie('/api/wishlist', cookie);

  if (response.status === 401) return { unauthorized: true };

  return (await response.json()) as WishlistResponseDto;
}

/**
 * Fetch the authenticated user's buying opportunities for the wishlist v2.2
 * «Зараз вигідно купити» section (`GET /api/wishlist/buying-opportunities`).
 * Runs server-side — mirrors {@link getWishlist} exactly: forwarded session
 * cookie, `no-store`, 8s AbortController timeout, 401 → `{ unauthorized: true }`
 * sentinel, other non-2xx/transport failures → {@link WishlistError}.
 */
export async function getBuyingOpportunities({
  cookie,
}: {
  cookie: string;
}): Promise<BuyingOpportunitiesResponseDto | { unauthorized: true }> {
  const response = await getWithCookie('/api/wishlist/buying-opportunities', cookie);

  if (response.status === 401) return { unauthorized: true };

  return (await response.json()) as BuyingOpportunitiesResponseDto;
}

/**
 * Add a book to the wishlist (S9 `POST /api/wishlist`).
 * Runs browser-side — uses a relative URL so the Next.js `/api/*` rewrite
 * proxies the request. Auth via httpOnly cookie sent automatically.
 * Throws {@link WishlistError} on non-2xx (status exposed so callers can
 * detect 401 and prompt for login).
 */
export async function addToWishlist(bookId: string): Promise<void> {
  await apiRequest('/api/wishlist', {
    method: 'POST',
    credentials: 'include',
    body: { bookId },
    errorClass: WishlistError,
    transportMessage: 'Не вдалося додати книгу до бажанок.',
    httpMessage: (status) => `Не вдалося додати книгу до бажанок (${status}).`,
  });
}

/**
 * Remove a book from the wishlist (S9 `DELETE /api/wishlist/:bookId`).
 * Runs browser-side. Throws {@link WishlistError} on non-2xx.
 */
export async function removeFromWishlist(bookId: string): Promise<void> {
  await apiRequest(`/api/wishlist/${bookId}`, {
    method: 'DELETE',
    credentials: 'include',
    errorClass: WishlistError,
    transportMessage: 'Не вдалося видалити книгу з бажанок.',
    httpMessage: (status) => `Не вдалося видалити книгу з бажанок (${status}).`,
  });
}

/** Raw `GET /api/wishlist` result (or 401 sentinel) → the alert context for one book. */
export function alertContextFromWishlist(
  result: WishlistResponseDto | { unauthorized: true },
  bookId: string,
): { inWishlist: boolean; alert: AlertDto | null } {
  if ('unauthorized' in result) return { inWishlist: false, alert: null };

  const item = result.items.find((i) => i.book.id === bookId);
  if (item == null) return { inWishlist: false, alert: null };

  return { inWishlist: true, alert: item.alert };
}

/**
 * Fetch alert context for a single book from the wishlist without a new endpoint.
 * Reuses `GET /api/wishlist` server-side (W4b decision: no new endpoint per plan),
 * finds the item matching `bookId`, and returns its `inWishlist` flag and `alert`.
 * Degrades gracefully — returns `{ inWishlist: false, alert: null }` on 401,
 * any non-2xx, or transport error (never throws).
 *
 * @param bookId - The canonical book id to find in the wishlist.
 * @param cookie - The forwarded session cookie string from `next/headers`.
 */
export async function getBookAlertContext({
  bookId,
  cookie,
}: {
  bookId: string;
  cookie: string;
}): Promise<{ inWishlist: boolean; alert: AlertDto | null }> {
  try {
    return alertContextFromWishlist(await getWishlist({ cookie }), bookId);
  } catch {
    return { inWishlist: false, alert: null };
  }
}
