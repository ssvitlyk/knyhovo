import type {
  CollectionBooksPageDto,
  CollectionDetailDto,
  CollectionsHomeDto,
  CollectionsSimilarDto,
} from './types';

const REQUEST_TIMEOUT_MS = 8000;

/** Error thrown when a collections request fails (network, timeout, or non-2xx, except 404 sentinels). */
export class CollectionsError extends Error {
  /** HTTP status, or `null` for a transport/timeout failure. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'CollectionsError';
    this.status = status;
  }
}

export interface CollectionBooksArgs {
  readonly page?: number;
  readonly sort?: string;
  readonly limit?: number;
  readonly cookie: string;
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:3000';
}

/**
 * Shared fetch helper for the Collections endpoints. Runs server-side, so the
 * absolute backend URL is hit directly — no CORS. The request carries an
 * explicit timeout (security rule: external HTTP must time out, no hidden
 * retries) and forwards the session `cookie` so `isWishlisted` reflects the
 * logged-in user.
 */
async function fetchJson<T>(
  url: string,
  cookie: string,
  transportErrorMessage: string,
  errorMessage: (status: number) => string,
): Promise<T | { notFound: true }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { cookie },
    });
  } catch {
    throw new CollectionsError(transportErrorMessage, null);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) return { notFound: true };

  if (!response.ok) {
    throw new CollectionsError(errorMessage(response.status), response.status);
  }

  return (await response.json()) as T;
}

/** Fetch the Collections home page (all sections + featured collection). */
export async function getCollectionsHome({
  cookie,
}: {
  cookie: string;
}): Promise<CollectionsHomeDto> {
  const url = `${apiBaseUrl()}/api/collections/home`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { cookie },
    });
  } catch {
    throw new CollectionsError('Не вдалося звʼязатися з сервісом колекцій.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new CollectionsError(
      `Сервіс колекцій повернув помилку (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as CollectionsHomeDto;
}

/** Fetch a single collection's metadata by slug. Returns `{ notFound: true }` on 404. */
export async function getCollection(
  slug: string,
  { cookie }: { cookie: string },
): Promise<CollectionDetailDto | { notFound: true }> {
  const url = `${apiBaseUrl()}/api/collections/${slug}`;
  return fetchJson<CollectionDetailDto>(
    url,
    cookie,
    'Не вдалося звʼязатися з сервісом колекцій.',
    (status) => `Сервіс колекцій повернув помилку (${status}).`,
  );
}

function buildBooksQuery({ page, sort, limit }: Omit<CollectionBooksArgs, 'cookie'>): string {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', String(page));
  if (sort !== undefined) params.set('sort', sort);
  if (limit !== undefined) params.set('limit', String(limit));
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
}

/** Fetch a page of books within a collection by slug. Returns `{ notFound: true }` on 404. */
export async function getCollectionBooks(
  slug: string,
  { page, sort, limit, cookie }: CollectionBooksArgs,
): Promise<CollectionBooksPageDto | { notFound: true }> {
  const url = `${apiBaseUrl()}/api/collections/${slug}/books${buildBooksQuery({ page, sort, limit })}`;
  return fetchJson<CollectionBooksPageDto>(
    url,
    cookie,
    'Не вдалося звʼязатися з сервісом колекцій.',
    (status) => `Сервіс колекцій повернув помилку (${status}).`,
  );
}

/** Fetch a page of books within a genre by slug. Returns `{ notFound: true }` on 404. */
export async function getGenreBooks(
  slug: string,
  { page, sort, limit, cookie }: CollectionBooksArgs,
): Promise<CollectionBooksPageDto | { notFound: true }> {
  const url = `${apiBaseUrl()}/api/genres/${slug}/books${buildBooksQuery({ page, sort, limit })}`;
  return fetchJson<CollectionBooksPageDto>(
    url,
    cookie,
    'Не вдалося звʼязатися з сервісом колекцій.',
    (status) => `Сервіс колекцій повернув помилку (${status}).`,
  );
}

/** Fetch a page of books within a mood by slug. Returns `{ notFound: true }` on 404. */
export async function getMoodBooks(
  slug: string,
  { page, sort, limit, cookie }: CollectionBooksArgs,
): Promise<CollectionBooksPageDto | { notFound: true }> {
  const url = `${apiBaseUrl()}/api/moods/${slug}/books${buildBooksQuery({ page, sort, limit })}`;
  return fetchJson<CollectionBooksPageDto>(
    url,
    cookie,
    'Не вдалося звʼязатися з сервісом колекцій.',
    (status) => `Сервіс колекцій повернув помилку (${status}).`,
  );
}

/** Fetch collections similar to the given collection slug. */
export async function getSimilarCollections(
  slug: string,
  { cookie }: { cookie: string },
): Promise<CollectionsSimilarDto> {
  const url = `${apiBaseUrl()}/api/collections/${slug}/similar`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { cookie },
    });
  } catch {
    throw new CollectionsError('Не вдалося звʼязатися з сервісом колекцій.', null);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new CollectionsError(
      `Сервіс колекцій повернув помилку (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as CollectionsSimilarDto;
}
