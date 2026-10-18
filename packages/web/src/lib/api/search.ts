import { apiBaseUrl } from './env';
import { apiJson, defineApiError } from './http';
import type { SearchResponseDto } from './types';

/**
 * `sort` values accepted by `GET /api/search` (search-sort PRD); UI ids map
 * 1:1 to the API. Single source of truth — reused by `SortControls`,
 * `Pagination` and the `/search` page for URL parsing.
 */
export type SearchSort = 'price_asc' | 'popular' | 'newest';

/** API default page size (packages/api/src/search/schema.ts). */
export const DEFAULT_PAGE_SIZE = 20;

/** Error thrown when the search request fails (network, timeout, or non-2xx). */
export class SearchError extends defineApiError('SearchError') {}

export interface SearchArgs {
  readonly q: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: SearchSort;
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
  sort,
}: SearchArgs): Promise<SearchResponseDto> {
  const params = new URLSearchParams({ q, page: String(page), pageSize: String(pageSize) });
  if (sort) params.set('sort', sort);
  return apiJson<SearchResponseDto>(`${apiBaseUrl()}/api/search?${params.toString()}`, {
    cache: 'no-store',
    errorClass: SearchError,
    transportMessage: 'Не вдалося звʼязатися з сервісом пошуку.',
    httpMessage: (status) => `Сервіс пошуку повернув помилку (${status}).`,
  });
}
