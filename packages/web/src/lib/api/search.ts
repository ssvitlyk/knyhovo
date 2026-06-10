import type { SearchResponseDto } from './types';

/** API default page size (packages/api/src/search/schema.ts). */
export const DEFAULT_PAGE_SIZE = 20;

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when the search request fails (network, timeout, or non-2xx). */
export class SearchError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'SearchError';
    this.status = status;
  }
}

export interface SearchArgs {
  readonly q: string;
  readonly page?: number;
  readonly pageSize?: number;
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:3000';
}

/**
 * Call `GET /api/search` (S8a). Runs server-side (Server Component / route),
 * so the absolute backend URL is hit directly — no CORS. The request carries an
 * explicit timeout (security rule: external HTTP must time out, no hidden
 * retries). Throws {@link SearchError} on transport, timeout, or non-2xx.
 */
export async function searchBooks({
  q,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: SearchArgs): Promise<SearchResponseDto> {
  const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) });
  const url = `${apiBaseUrl()}/api/search?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } catch {
    throw new SearchError('Не вдалося звʼязатися з сервісом пошуку.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new SearchError(`Сервіс пошуку повернув помилку (${response.status}).`, response.status);
  }

  return (await response.json()) as SearchResponseDto;
}
