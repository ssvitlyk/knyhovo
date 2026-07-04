import type {
  CollectionBooksPageDto,
  CollectionDto,
  CollectionsApiSort,
  CollectionsHubDto,
} from './types';

/** Fixed page size for collection book listings (Collections PRD, not the 15 from the design mock). */
export const COLLECTION_PAGE_SIZE = 24;

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when a collections request fails (network, timeout, or non-2xx). */
export class CollectionsError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;
  /** API error-envelope code (e.g. `COLLECTION_NOT_FOUND`), when the body carried one. */
  readonly code: string | null;

  constructor(message: string, status: number | null, code: string | null = null) {
    super(message);
    this.name = 'CollectionsError';
    this.status = status;
    this.code = code;
  }
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:3000';
}

/** Parse the repo-standard error envelope `{ error: { code, message } }`; null when absent. */
async function readErrorEnvelope(
  response: Response,
): Promise<{ code: string | null; message: string | null }> {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; message?: unknown };
    };
    return {
      code: typeof body.error?.code === 'string' ? body.error.code : null,
      message: typeof body.error?.message === 'string' ? body.error.message : null,
    };
  } catch {
    return { code: null, message: null };
  }
}

/**
 * Shared fetch helper for the collections endpoints. Runs server-side (Server
 * Component / route), so the absolute backend URL is hit directly — no CORS.
 * The request carries an explicit timeout (security rule: external HTTP must
 * time out, no hidden retries). Throws {@link CollectionsError} on transport,
 * timeout, or non-2xx — with the envelope code attached when available.
 */
async function fetchCollectionsJson<T>(path: string, redirect?: RequestRedirect): Promise<T> {
  const url = `${apiBaseUrl()}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      ...(redirect ? { redirect } : {}),
    });
  } catch {
    throw new CollectionsError('Не вдалося звʼязатися з сервісом добірок.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const envelope = await readErrorEnvelope(response);
    throw new CollectionsError(
      envelope.message ?? `Сервіс добірок повернув помилку (${response.status}).`,
      response.status,
      envelope.code,
    );
  }

  return (await response.json()) as T;
}

/** Call `GET /api/collections/hub` — the single aggregated hub payload for `/dobirky`. */
export async function getCollectionsHub(): Promise<CollectionsHubDto> {
  return fetchCollectionsJson<CollectionsHubDto>('/api/collections/hub');
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
  const url = `${apiBaseUrl()}/api/collections/${encodeURIComponent(slug)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    throw new CollectionsError('Не вдалося звʼязатися з сервісом добірок.', null);
  } finally {
    clearTimeout(timer);
  }

  // Genre below the 30-book threshold → backend 301 → hub.
  if (response.status === 301 || response.status === 308) return { redirectedToHub: true };

  if (!response.ok) {
    const envelope = await readErrorEnvelope(response);
    throw new CollectionsError(
      envelope.message ?? `Сервіс добірок повернув помилку (${response.status}).`,
      response.status,
      envelope.code,
    );
  }

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
}: CollectionBooksArgs): Promise<CollectionBooksPageDto> {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (sort) params.set('sort', sort);
  if (genre) params.set('genre', genre);
  if (priceMin !== undefined) params.set('price_min', String(priceMin));
  if (priceMax !== undefined) params.set('price_max', String(priceMax));
  if (inStock !== undefined) params.set('in_stock', inStock ? '1' : '0');

  return fetchCollectionsJson<CollectionBooksPageDto>(
    `/api/collections/${encodeURIComponent(slug)}/books?${params.toString()}`,
  );
}

/** Call `GET /api/collections` — all active collections, in displayOrder (sitemap/similar). */
export async function listCollections(): Promise<{ collections: readonly CollectionDto[] }> {
  return fetchCollectionsJson<{ collections: readonly CollectionDto[] }>('/api/collections');
}
