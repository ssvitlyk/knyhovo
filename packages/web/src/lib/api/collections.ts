import { apiBaseUrl } from './env';
import { apiJson, apiRequest, defineApiError, type ApiRequestOptions } from './http';
import type {
  CollectionBooksPageDto,
  CollectionDto,
  CollectionsApiSort,
  CollectionsHubDto,
} from './types';

/** Fixed page size for collection book listings (Collections PRD, not the 15 from the design mock). */
export const COLLECTION_PAGE_SIZE = 24;

/** Error thrown when a collections request fails (network, timeout, or non-2xx). */
export class CollectionsError extends defineApiError('CollectionsError') {}

/**
 * Shared fetch options for the collections endpoints. Runs server-side (Server
 * Component / route), so the absolute backend URL is hit directly — no CORS.
 * Failures throw {@link CollectionsError} — with the envelope code attached when available.
 */
const COLLECTIONS_REQUEST = {
  cache: 'no-store',
  errorClass: CollectionsError,
  envelope: true,
  logTag: 'collections',
  transportMessage: 'Не вдалося звʼязатися з сервісом добірок.',
  httpMessage: (status: number) => `Сервіс добірок повернув помилку (${status}).`,
} as const satisfies ApiRequestOptions;

function fetchCollectionsJson<T>(
  path: string,
  options?: { readonly cookie?: string },
): Promise<T> {
  return apiJson<T>(`${apiBaseUrl()}${path}`, { ...COLLECTIONS_REQUEST, cookie: options?.cookie });
}

/**
 * Call `GET /api/collections/hub` — the single aggregated hub payload for
 * `/dobirky`. Forwarding the session cookie decorates `previewBooks` with the
 * caller's real `isWishlisted`; omitted for guests (always `false`).
 */
export async function getCollectionsHub(options?: { readonly cookie?: string }): Promise<CollectionsHubDto> {
  return fetchCollectionsJson<CollectionsHubDto>('/api/collections/hub', { cookie: options?.cookie });
}

/**
 * Call `GET /api/collections/:slug`. Redirects are NOT followed: a taxonomic
 * collection under the 30-book threshold answers 301, which the caller must
 * turn into `redirect('/dobirky')` — the sentinel `{ redirectedToHub: true }`
 * signals that case. Unknown slug throws {@link CollectionsError} with 404.
 */
export async function getCollection(
  slug: string,
): Promise<{ collection: CollectionDto } | { redirectedToHub: true }> {
  const response = await apiRequest(`${apiBaseUrl()}/api/collections/${encodeURIComponent(slug)}`, {
    ...COLLECTIONS_REQUEST,
    redirect: 'manual',
    // Genre below the 30-book threshold → backend 301 → hub.
    passthrough: (status) => status === 301 || status === 308,
  });

  if (response.status === 301 || response.status === 308) return { redirectedToHub: true };

  return (await response.json()) as { collection: CollectionDto };
}

export interface CollectionBooksArgs {
  readonly slug: string;
  readonly page?: number;
  readonly perPage?: number;
  readonly sort?: CollectionsApiSort;
  readonly genre?: string;
  /** Kopiyky. */
  readonly priceMin?: number;
  /** Kopiyky. */
  readonly priceMax?: number;
  readonly inStock?: boolean;
  /** Forwarded session cookie; decorates each book's `isWishlisted`. */
  readonly cookie?: string;
}

/** Call `GET /api/collections/:slug/books` — paginated book cards for one collection. */
export async function getCollectionBooks({
  slug,
  page = 1,
  perPage = COLLECTION_PAGE_SIZE,
  sort,
  genre,
  priceMin,
  priceMax,
  inStock,
  cookie,
}: CollectionBooksArgs): Promise<CollectionBooksPageDto> {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (sort) params.set('sort', sort);
  if (genre) params.set('genre', genre);
  if (priceMin !== undefined) params.set('price_min', String(priceMin));
  if (priceMax !== undefined) params.set('price_max', String(priceMax));
  if (inStock !== undefined) params.set('in_stock', inStock ? '1' : '0');

  return fetchCollectionsJson<CollectionBooksPageDto>(
    `/api/collections/${encodeURIComponent(slug)}/books?${params.toString()}`,
    { cookie },
  );
}

/** Call `GET /api/collections` — all active collections, in displayOrder (sitemap/similar). */
export async function listCollections(): Promise<{ collections: readonly CollectionDto[] }> {
  return fetchCollectionsJson<{ collections: readonly CollectionDto[] }>('/api/collections');
}
