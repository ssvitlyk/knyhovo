import { SearchError } from './search';
import type { SearchResponseDto } from './types';

export interface ClientSearchArgs {
  readonly q: string;
  readonly signal?: AbortSignal;
  readonly pageSize?: number;
}

/**
 * Browser-side suggestion fetch: hits the same-origin Next route handler
 * `/api/search`. Abortable for debounce cancellation.
 * Throws {@link SearchError} on non-2xx / transport.
 */
export async function clientSearch(args: ClientSearchArgs): Promise<SearchResponseDto> {
  const { q, signal, pageSize = 6 } = args;

  const params = new URLSearchParams({ q, pageSize: String(pageSize) });
  const url = `/api/search?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err as Error).name === 'AbortError'
    ) {
      throw err;
    }
    throw new SearchError('Не вдалося завʼязатися з сервісом пошуку.', null);
  }

  if (!response.ok) {
    throw new SearchError('Не вдалося завантажити підказки.', response.status);
  }

  return (await response.json()) as SearchResponseDto;
}
