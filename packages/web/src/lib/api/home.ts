import { apiBaseUrl } from './env';
import type { HomeResponseDto } from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when the `GET /api/home` request fails (network, timeout, or non-2xx). */
export class HomeError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'HomeError';
    this.status = status;
  }
}

/**
 * Call `GET /api/home` — the single composed homepage feed (dedup + provider
 * diversity done on the backend). Runs server-side (Server Component), so the
 * absolute backend URL is hit directly. Forwarding the session cookie decorates
 * each book's `isWishlisted`; omitted for guests. Explicit timeout, no hidden
 * retries (security rule). Throws {@link HomeError} on transport/timeout/non-2xx.
 */
export async function getHome(options?: { readonly cookie?: string }): Promise<HomeResponseDto> {
  const url = `${apiBaseUrl()}/api/home`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      ...(options?.cookie ? { headers: { cookie: options.cookie } } : {}),
    });
  } catch (cause) {
    console.error('[home] transport failure', { url, cause });
    throw new HomeError('Не вдалося звʼязатися з сервісом головної сторінки.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new HomeError(`Сервіс головної сторінки повернув помилку (${response.status}).`, response.status);
  }

  return (await response.json()) as HomeResponseDto;
}
