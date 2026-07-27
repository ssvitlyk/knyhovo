import type { AlertDto, AlertMode } from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Shape of the `{ error: { code, message } }` body the API sends on failure. */
interface ApiErrorBody {
  readonly error?: { readonly code?: string; readonly message?: string };
}

/** Error thrown when a price-alert request fails (network, timeout, or non-2xx). */
export class AlertError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;
  /** Server error code (e.g. `THRESHOLD_NOT_BELOW_CURRENT`), or `null` for a transport failure or an unparsable body. */
  readonly code: string | null;

  constructor(message: string, status: number | null, code: string | null = null) {
    super(message);
    this.name = 'AlertError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Try to read the server's `{ error: { code, message } }` body. Returns null
 * when the body isn't valid JSON (e.g. an upstream proxy error page) — callers
 * fall back to a generic message in that case.
 */
async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/wishlist/${encodeURIComponent(bookId)}/alert`, {
      method: 'PUT',
      signal: controller.signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(threshold !== undefined ? { mode, threshold } : { mode }),
    });
  } catch {
    throw new AlertError('Не вдалося ввімкнути сповіщення.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    if (body?.error?.message != null) {
      throw new AlertError(body.error.message, response.status, body.error.code ?? null);
    }
    throw new AlertError(`Не вдалося ввімкнути сповіщення (${response.status}).`, response.status);
  }

  const { alert } = (await response.json()) as { alert: AlertDto };
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
    const body = await readErrorBody(response);
    if (body?.error?.message != null) {
      throw new AlertError(body.error.message, response.status, body.error.code ?? null);
    }
    throw new AlertError(`Не вдалося оновити сповіщення (${response.status}).`, response.status);
  }
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
    const body = await readErrorBody(response);
    if (body?.error?.message != null) {
      throw new AlertError(body.error.message, response.status, body.error.code ?? null);
    }
    throw new AlertError(`Не вдалося прибрати сповіщення (${response.status}).`, response.status);
  }
}
