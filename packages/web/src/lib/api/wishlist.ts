import type { AlertDto, WishlistResponseDto } from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when a wishlist request fails (network, timeout, or non-2xx, except 401 sentinels). */
export class WishlistError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'WishlistError';
    this.status = status;
  }
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:3000';
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
  const url = `${apiBaseUrl()}/api/wishlist`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { cookie },
    });
  } catch {
    throw new WishlistError('Не вдалося звʼязатися з сервісом бажанок.', null);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) return { unauthorized: true };

  if (!response.ok) {
    throw new WishlistError(
      `Сервіс бажанок повернув помилку (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as WishlistResponseDto;
}

/**
 * Add a book to the wishlist (S9 `POST /api/wishlist`).
 * Runs browser-side — uses a relative URL so the Next.js `/api/*` rewrite
 * proxies the request. Auth via httpOnly cookie sent automatically.
 * Throws {@link WishlistError} on non-2xx (status exposed so callers can
 * detect 401 and prompt for login).
 */
export async function addToWishlist(bookId: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('/api/wishlist', {
      method: 'POST',
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId }),
    });
  } catch {
    throw new WishlistError('Не вдалося додати книгу до бажанок.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new WishlistError(
      `Не вдалося додати книгу до бажанок (${response.status}).`,
      response.status,
    );
  }
}

/**
 * Remove a book from the wishlist (S9 `DELETE /api/wishlist/:bookId`).
 * Runs browser-side. Throws {@link WishlistError} on non-2xx.
 */
export async function removeFromWishlist(bookId: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/wishlist/${bookId}`, {
      method: 'DELETE',
      signal: controller.signal,
      credentials: 'include',
    });
  } catch {
    throw new WishlistError('Не вдалося видалити книгу з бажанок.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new WishlistError(
      `Не вдалося видалити книгу з бажанок (${response.status}).`,
      response.status,
    );
  }
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
  const FALLBACK = { inWishlist: false, alert: null };

  let result: WishlistResponseDto | { unauthorized: true };
  try {
    result = await getWishlist({ cookie });
  } catch {
    return FALLBACK;
  }

  if ('unauthorized' in result) return FALLBACK;

  const item = result.items.find((i) => i.book.id === bookId);
  if (item == null) return FALLBACK;

  return { inWishlist: true, alert: item.alert };
}

/**
 * Check whether a specific book is in the wishlist (S9 `GET /api/wishlist/status/:bookId`).
 * Runs server-side. Degrades gracefully — returns `false` on 401 (unauthenticated)
 * and on any other non-2xx so the book page never breaks due to wishlist errors.
 */
export async function getWishlistStatus({
  bookId,
  cookie,
}: {
  bookId: string;
  cookie: string;
}): Promise<boolean> {
  const url = `${apiBaseUrl()}/api/wishlist/status/${bookId}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { cookie },
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) return false;

  const body = (await response.json()) as { inWishlist: boolean };
  return body.inWishlist;
}
