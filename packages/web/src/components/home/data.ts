import { getHome } from '@/lib/api/home';
import type { CollectionBookDto } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';
import type { HomeBadge, HomeBook } from './content';

/** Safety cap per shelf — the backend already composes ≤12, this just guards against a wider payload. */
const SHELF_CAP = 12;

/** Badge rule: the «novynky» shelf always gets «Новинка»; other shelves use the real discount, when any. */
function badgeFor(key: string, dto: CollectionBookDto): HomeBadge | null {
  if (key === 'novynky') return 'accent:Новинка';
  if (dto.discountPercent !== null && dto.discountPercent >= 1) return `solid:-${dto.discountPercent}%`;
  return null;
}

/** Narrows `minPrice` to non-null so priced-only mapping below is cast-free. */
type PricedCollectionBookDto = CollectionBookDto & { readonly minPrice: NonNullable<CollectionBookDto['minPrice']> };

function isPriced(dto: CollectionBookDto): dto is PricedCollectionBookDto {
  return dto.minPrice !== null;
}

function toHomeBook(key: string, dto: PricedCollectionBookDto): HomeBook {
  return {
    id: dto.id,
    href: dto.url,
    title: dto.title,
    author: dto.author,
    price: formatMoney(dto.minPrice),
    oldPrice: dto.oldPrice ? formatMoney(dto.oldPrice) : null,
    store: dto.storeName,
    cover: dto.coverUrl || null,
    offersCount: dto.offersCount,
    badge: badgeFor(key, dto),
  };
}

/** One composed homepage shelf, ready to render: opaque key + mapped books (in backend display order). */
export interface HomeShelfView {
  readonly key: string;
  readonly books: readonly HomeBook[];
}

/**
 * Fetch the composed homepage feed from the backend in a SINGLE request
 * (`GET /api/home`). Cross-section dedup and provider diversity are the
 * backend's responsibility — the web does no allocation/dedup of its own.
 *
 * Guest view here (no cookie forwarded, so `isWishlisted` is unused). Shelves
 * arrive in display order; empty shelves are already omitted by the backend,
 * but any shelf that maps to zero priced books is dropped too. A full endpoint
 * failure degrades to `[]` — the page then renders the hero only (PRD §10), no
 * fallback to the old three-collection fetch.
 */
export async function getHomeShelves(): Promise<readonly HomeShelfView[]> {
  try {
    const { shelves } = await getHome();
    return shelves
      .map((shelf) => ({
        key: shelf.key,
        books: shelf.books.filter(isPriced).slice(0, SHELF_CAP).map((b) => toHomeBook(shelf.key, b)),
      }))
      .filter((shelf) => shelf.books.length > 0);
  } catch {
    return [];
  }
}
