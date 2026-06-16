import type { AlertIntent } from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when a price-alert request fails (network, timeout, or non-2xx). */
export class AlertError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'AlertError';
    this.status = status;
  }
}

/**
 * Create or replace the price alert for a wishlist item (W4a `PUT /api/wishlist/:bookId/alert`).
 * Runs browser-side — uses a relative URL so the Next.js `/api/*` rewrite proxies the request.
 * Auth via httpOnly cookie sent automatically (`credentials: 'include'`).
 *
 * @param bookId - The canonical book id (must already be in the wishlist).
 * @param intent - The user's chosen alert intent.
 * @param targetPrice - The resolved target price in kopiyky (amount must be a positive integer).
 *
 * Throws {@link AlertError} on non-2xx (status exposed so callers can detect 401/404).
 */
export async function setAlert(
  bookId: string,
  intent: AlertIntent,
  targetPrice: { amount: number; currency: 'UAH' },
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/wishlist/${encodeURIComponent(bookId)}/alert`, {
      method: 'PUT',
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent, targetPrice }),
    });
  } catch {
    throw new AlertError('Не вдалося ввімкнути сповіщення.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AlertError(
      `Не вдалося ввімкнути сповіщення (${response.status}).`,
      response.status,
    );
  }
}

/**
 * Pause or unpause the price alert for a wishlist item (W4a `PATCH /api/wishlist/:bookId/alert`).
 * Runs browser-side. Auth via httpOnly cookie sent automatically.
 *
 * @param bookId - The canonical book id.
 * @param paused - `true` to pause, `false` to resume.
 *
 * Throws {@link AlertError} on non-2xx.
 */
export async function pauseAlert(bookId: string, paused: boolean): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/wishlist/${encodeURIComponent(bookId)}/alert`, {
      method: 'PATCH',
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused }),
    });
  } catch {
    throw new AlertError('Не вдалося оновити сповіщення.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AlertError(
      `Не вдалося оновити сповіщення (${response.status}).`,
      response.status,
    );
  }
}

/**
 * Remove the price alert for a wishlist item (W4a `DELETE /api/wishlist/:bookId/alert`).
 * Runs browser-side. The operation is idempotent — no-op if no alert exists.
 * Auth via httpOnly cookie sent automatically.
 *
 * @param bookId - The canonical book id.
 *
 * Throws {@link AlertError} on non-2xx.
 */
export async function removeAlert(bookId: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/wishlist/${encodeURIComponent(bookId)}/alert`, {
      method: 'DELETE',
      signal: controller.signal,
      credentials: 'include',
    });
  } catch {
    throw new AlertError('Не вдалося прибрати сповіщення.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AlertError(
      `Не вдалося прибрати сповіщення (${response.status}).`,
      response.status,
    );
  }
}
