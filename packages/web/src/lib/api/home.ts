import { apiBaseUrl } from './env';
import { apiJson, defineApiError } from './http';
import type { HomeResponseDto } from './types';

/** Error thrown when the `GET /api/home` request fails (network, timeout, or non-2xx). */
export class HomeError extends defineApiError('HomeError') {}

/**
 * Call `GET /api/home` — the single composed homepage feed (dedup + provider
 * diversity done on the backend). Runs server-side (Server Component), so the
 * absolute backend URL is hit directly. Forwarding the session cookie decorates
 * each book's `isWishlisted`; omitted for guests. Explicit timeout, no hidden
 * retries (security rule). Throws {@link HomeError} on transport/timeout/non-2xx.
 */
export async function getHome(options?: { readonly cookie?: string }): Promise<HomeResponseDto> {
  return apiJson<HomeResponseDto>(`${apiBaseUrl()}/api/home`, {
    cache: 'no-store',
    cookie: options?.cookie,
    errorClass: HomeError,
    logTag: 'home',
    transportMessage: 'Не вдалося звʼязатися з сервісом головної сторінки.',
    httpMessage: (status) => `Сервіс головної сторінки повернув помилку (${status}).`,
  });
}
