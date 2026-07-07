import { getCollectionBooks } from '@/lib/api/collections';
import type { CollectionBookDto } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';
import type { HomeBadge, HomeBook } from './content';

/** Max cards shown per homepage shelf — matches the collection detail page's real pool. */
const SHELF_CAP = 12;

type ShelfSlug = 'populyarne-zaraz' | 'novynky' | 'knyhovyk-radyt';

/** Badge rule per shelf: novynky always gets «Новинка»; the others use the real discount, when any. */
function badgeFor(slug: ShelfSlug, dto: CollectionBookDto): HomeBadge | null {
  if (slug === 'novynky') return 'accent:Новинка';
  if (dto.discountPercent !== null && dto.discountPercent >= 1) return `solid:-${dto.discountPercent}%`;
  return null;
}

/** Narrows `minPrice` to non-null so priced-only mapping below is cast-free. */
type PricedCollectionBookDto = CollectionBookDto & { readonly minPrice: NonNullable<CollectionBookDto['minPrice']> };

function isPriced(dto: CollectionBookDto): dto is PricedCollectionBookDto {
  return dto.minPrice !== null;
}

function toHomeBook(slug: ShelfSlug, dto: PricedCollectionBookDto): HomeBook {
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
    badge: badgeFor(slug, dto),
  };
}

/** Fetch one shelf's books; any failure (down API, missing collection) degrades to an empty shelf, never a crash. */
async function loadShelf(slug: ShelfSlug): Promise<readonly HomeBook[]> {
  try {
    const { books } = await getCollectionBooks({ slug, page: 1 });
    return books
      .filter(isPriced)
      .slice(0, SHELF_CAP)
      .map((b) => toHomeBook(slug, b));
  } catch {
    return [];
  }
}

export interface HomeShelves {
  readonly popular: readonly HomeBook[];
  readonly newReleases: readonly HomeBook[];
  readonly recommends: readonly HomeBook[];
}

/**
 * Fetch the three homepage discovery shelves from the collections API in
 * parallel (guest view — no cookie forwarded, so `isWishlisted` is unused
 * here). Each shelf degrades to `[]` independently on error; the shelf
 * components already hide an empty section.
 */
export async function getHomeShelves(): Promise<HomeShelves> {
  const [popular, newReleases, recommends] = await Promise.all([
    loadShelf('populyarne-zaraz'),
    loadShelf('novynky'),
    loadShelf('knyhovyk-radyt'),
  ]);
  return { popular, newReleases, recommends };
}
