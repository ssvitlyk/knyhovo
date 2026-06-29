/** Production KSD GraphQL endpoint. */
export const KSD_GRAPHQL_ENDPOINT = 'https://prod-api.ksd.ua/graphql';

/** KSD canonical site base URL (no trailing slash). */
export const KSD_BASE_URL = 'https://ksd.ua';

/** Default number of catalog products to fetch per page during discovery. */
export const DEFAULT_CATALOG_PER_PAGE = 100;

/** Default number of product slugs to enrich per alias-batch request. */
export const DEFAULT_BATCH_SIZE = 30;

/** Default maximum number of products to scrape in a single run. */
export const DEFAULT_MAX_PRODUCTS = 60;

/** Default HTTP request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Default delay between requests in milliseconds. */
export const DEFAULT_DELAY_MS = 500;

/**
 * Build the canonical product page URL for a KSD slug.
 */
export function buildProductUrl(slug: string): string {
  return `${KSD_BASE_URL}/product/${slug}`;
}

/** Raw shape of a `small` image entry (all fields untrusted). */
interface SmallImageEntry {
  readonly format?: unknown;
  readonly url?: unknown;
}

/** Raw shape of the `image` field on a KSD product (all fields untrusted). */
interface BookClubImageRaw {
  readonly small?: unknown;
}

/**
 * Resolve a KSD product `image` object to an absolute cover URL.
 *
 * Preference order within `image.small[]`:
 * 1. First entry whose format is NOT 'webp' and has a non-empty string url.
 * 2. Fallback: first webp entry with a non-empty string url.
 * 3. Fallback: first entry with any non-empty string url.
 *
 * URL resolution:
 * - Starts with 'http' → pass-through.
 * - Starts with '/' → `${KSD_BASE_URL}${url}`.
 * - Else → `${KSD_BASE_URL}/${url}`.
 *
 * Returns null for missing/non-string image or URL. Never throws.
 */
export function buildCoverUrl(image: unknown): string | null {
  if (typeof image !== 'object' || image === null) return null;
  const raw = image as BookClubImageRaw;
  if (!Array.isArray(raw.small)) return null;

  const entries = raw.small as SmallImageEntry[];

  // Pass 1: non-webp with a url
  for (const entry of entries) {
    if (entry.format !== 'webp') {
      const url = readNonEmptyString(entry.url);
      if (url !== null) return resolveUrl(url);
    }
  }

  // Pass 2: any webp with a url
  for (const entry of entries) {
    const url = readNonEmptyString(entry.url);
    if (url !== null) return resolveUrl(url);
  }

  return null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function resolveUrl(url: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${KSD_BASE_URL}${url}`;
  return `${KSD_BASE_URL}/${url}`;
}

// ─── GraphQL query builders ──────────────────────────────────────────────────

/**
 * Build the `catalogProducts` discovery query for a given page.
 */
export function buildCatalogProductsQuery(page: number, perPage: number): string {
  return `{ catalogProducts(per_page: ${perPage}, page: ${page}, format: paper, sort: by_date_desc) { meta { total per_page current_page last_page has_more_pages } data { slug name type available cost authors { name surname } image { small { format url } } } } }`;
}

/** Fields fetched per product in the alias-batch enrichment query. */
const PRODUCT_PAGE_FIELDS =
  'name isbn code type cost crossed_out_cost available in_stock authors { name surname } image { small { format url } }';

/**
 * Build an alias-batch `productPage` query for up to 30 slugs.
 * Each alias is `p${index}` (0-based), matching the index in the `slugs` array.
 */
export function buildProductPageBatchQuery(slugs: string[]): string {
  const aliases = slugs
    .map((slug, i) => `p${i}: productPage(slug: ${JSON.stringify(slug)}) { ${PRODUCT_PAGE_FIELDS} }`)
    .join(' ');
  return `{ ${aliases} }`;
}

// ─── Raw untrusted interfaces ────────────────────────────────────────────────

/** Raw author shape from KSD API (all fields untrusted). */
export interface BookClubAuthor {
  readonly name?: unknown;
  readonly surname?: unknown;
}

/** Raw image shape from KSD API (all fields untrusted). */
export interface BookClubImage {
  readonly small?: unknown;
}

/** Raw productPage shape from KSD API (all fields untrusted). */
export interface BookClubProductPage {
  readonly name?: unknown;
  readonly isbn?: unknown;
  readonly code?: unknown;
  readonly type?: unknown;
  readonly cost?: unknown;
  readonly crossed_out_cost?: unknown;
  readonly available?: unknown;
  readonly in_stock?: unknown;
  readonly authors?: unknown;
  readonly image?: unknown;
}

/** Raw catalog card shape from catalogProducts.data[] (all fields untrusted). */
export interface BookClubCatalogCard {
  readonly slug?: unknown;
  readonly name?: unknown;
  readonly type?: unknown;
  readonly available?: unknown;
  readonly cost?: unknown;
  readonly authors?: unknown;
  readonly image?: unknown;
}

/** Raw meta shape from catalogProducts.meta (all fields untrusted). */
export interface CatalogMeta {
  readonly total?: unknown;
  readonly per_page?: unknown;
  readonly current_page?: unknown;
  readonly last_page?: unknown;
  readonly has_more_pages?: unknown;
}
