import { apiJson, apiRequest, defineApiError, type ApiRequestOptions } from './http';
import type { AlertDto, AlertMode } from './types';

/** Error thrown when a price-alert request fails (network, timeout, or non-2xx). `code` is the server error code (e.g. `THRESHOLD_NOT_BELOW_CURRENT`) when the body carried one. */
export class AlertError extends defineApiError('AlertError') {}

/** Shared options: server's own (already human-readable) message/code win over the generic fallback. */
function alertOptions(
  verb: string,
  options: Pick<ApiRequestOptions, 'method' | 'body'>,
): ApiRequestOptions {
  return {
    ...options,
    credentials: 'include',
    envelope: true,
    errorClass: AlertError,
    transportMessage: `Не вдалося ${verb}.`,
    httpMessage: (status) => `Не вдалося ${verb} (${status}).`,
  };
}

const alertUrl = (bookId: string): string => `/api/wishlist/${encodeURIComponent(bookId)}/alert`;

/**
 * Create or replace the price alert for a wishlist item
 * (notifications-model-v2 `PUT /api/wishlist/:bookId/alert`).
 * Runs browser-side — uses a relative URL so the Next.js `/api/*` rewrite
 * proxies the request. Auth via httpOnly cookie sent automatically (`credentials: 'include'`).
 *
 * @param bookId - The canonical book id (must already be in the wishlist).
 * @param mode - The alert mode the user picked.
 * @param threshold - Required (and only allowed) for `'my-price'`; kopiyky amount.
 *
 * Returns the resolved {@link AlertDto} the server actually stored — the
 * client never reconstructs it locally.
 *
 * Throws {@link AlertError} on non-2xx, using the server's own (already
 * human-readable, Ukrainian) `message` and `code` when the body parses as
 * JSON; falls back to a generic message only on transport/parse failure.
 */
export async function setAlert(
  bookId: string,
  mode: AlertMode,
  threshold?: { amount: number; currency: 'UAH' },
): Promise<AlertDto> {
  const { alert } = await apiJson<{ alert: AlertDto }>(
    alertUrl(bookId),
    alertOptions('ввімкнути сповіщення', {
      method: 'PUT',
      body: threshold !== undefined ? { mode, threshold } : { mode },
    }),
  );
  return alert;
}

/**
 * Pause or unpause the price alert for a wishlist item
 * (notifications-model-v2 `PATCH /api/wishlist/:bookId/alert`, unchanged).
 * Runs browser-side. Auth via httpOnly cookie sent automatically.
 *
 * Response is `{ ok: true }` (no fresh {@link AlertDto}) — callers must patch
 * their own optimistic copy.
 *
 * @param bookId - The canonical book id.
 * @param paused - `true` to pause, `false` to resume.
 *
 * Throws {@link AlertError} on non-2xx.
 */
export async function pauseAlert(bookId: string, paused: boolean): Promise<void> {
  await apiRequest(alertUrl(bookId), alertOptions('оновити сповіщення', { method: 'PATCH', body: { paused } }));
}

/**
 * Remove the price alert for a wishlist item
 * (notifications-model-v2 `DELETE /api/wishlist/:bookId/alert`, unchanged).
 * Runs browser-side. The operation is idempotent — no-op if no alert exists.
 * Auth via httpOnly cookie sent automatically.
 *
 * @param bookId - The canonical book id.
 *
 * Throws {@link AlertError} on non-2xx.
 */
export async function removeAlert(bookId: string): Promise<void> {
  await apiRequest(alertUrl(bookId), alertOptions('прибрати сповіщення', { method: 'DELETE' }));
}
