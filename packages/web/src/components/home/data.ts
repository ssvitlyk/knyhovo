import type { HomeShelfKey } from '@knyhovo/shared';
import { getHome, HomeError } from '@/lib/api/home';
import type { CollectionBookDto } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';
import type { HomeBadge, HomeBook } from './content';

/** Badge rule: the «novynky» shelf always gets «Новинка»; other shelves use the real discount, when any. */
function badgeFor(key: HomeShelfKey, dto: CollectionBookDto): HomeBadge | null {
  if (key === 'novynky') return 'accent:Новинка';
  if (dto.discountPercent !== null && dto.discountPercent >= 1) return `solid:-${dto.discountPercent}%`;
  return null;
}

/** Narrows `minPrice` to non-null so priced-only mapping is cast-free. */
type PricedCollectionBookDto = CollectionBookDto & { readonly minPrice: NonNullable<CollectionBookDto['minPrice']> };

function toHomeBook(key: HomeShelfKey, dto: PricedCollectionBookDto): HomeBook {
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

/** One composed homepage shelf, ready to render: shared-vocabulary key + mapped books (in backend display order). */
export interface HomeShelfView {
  readonly key: HomeShelfKey;
  readonly books: readonly HomeBook[];
}

/**
 * Map one shelf's books. The backend is the sole owner of Home candidate
 * validity and guarantees every composed book is priced (`minPrice !== null`),
 * so the web does NOT re-filter composition. A book that somehow arrives
 * unpriced is a backend/schema contract violation — it is logged (not silently
 * dropped) and excluded, since a card cannot render without a price.
 */
function mapShelf(key: HomeShelfKey, books: readonly CollectionBookDto[]): readonly HomeBook[] {
  const mapped: HomeBook[] = [];
  for (const dto of books) {
    if (dto.minPrice === null) {
      console.error('[home] schema violation: composed book missing minPrice', { key, id: dto.id });
      continue;
    }
    mapped.push(toHomeBook(key, dto as PricedCollectionBookDto));
  }
  return mapped;
}

/**
 * Fetch the composed homepage feed from the backend in a SINGLE request
 * (`GET /api/home`). Cross-section dedup, provider diversity and candidate
 * validity are the backend's responsibility — the web does no allocation/
 * dedup/validity filtering of its own.
 *
 * Guest view here (no cookie forwarded, so `isWishlisted` is unused). Shelves
 * arrive in display order; empty shelves are already omitted by the backend.
 * On failure the page degrades to the hero only (PRD §10) — no retry, no
 * fallback to the old three-collection fetch — and the error is logged (never
 * silently swallowed), distinguishing transport/API failures from unexpected
 * (mapping/schema) ones.
 */
export async function getHomeShelves(): Promise<readonly HomeShelfView[]> {
  try {
    const { shelves } = await getHome();
    return shelves
      .map((shelf) => ({ key: shelf.key, books: mapShelf(shelf.key, shelf.books) }))
      .filter((shelf) => shelf.books.length > 0);
  } catch (error) {
    if (error instanceof HomeError) {
      console.error('[home] /api/home request failed — rendering hero only', { status: error.status, message: error.message });
    } else {
      console.error('[home] unexpected error building home shelves — rendering hero only', { error });
    }
    return [];
  }
}
