import type { PrismaClient } from '@prisma/client';
import type { SearchParams } from './schema.js';
import type { SearchItemDto, SearchResponseDto } from './dto.js';
import type { CanonicalBookRow } from './repository.js';
import { searchCanonicalBooks, findWishlistCountsForBooks } from './repository.js';
import { toSearchItem } from './mapper.js';

/**
 * Execute a book search and assemble the paginated response.
 *
 * Pipeline: query matching books → map to DTOs (dropping books with no priced
 * listings) → sort per `params.sort` → paginate.
 *
 * NOTE (S8a tradeoff, extended by Search Sort v1.1): filtering, sorting and
 * pagination are performed in application code after fetching all query
 * matches, rather than in SQL. `lowestPrice` is derived across a book's
 * listings so it can't be expressed as a simple column sort, and `popular`
 * needs an extra wishlist-count query keyed by matched book ids. This is
 * acceptable at MVP volume; this endpoint is explicitly not the final API and
 * can later push these operations into SQL (refresh-architecture-w10).
 *
 * Every sort order is a total order — `popular` and `newest` break ties by
 * ascending price, then ascending id, so results never depend on incidental
 * array/DB ordering.
 */
export async function search(
  prisma: PrismaClient,
  params: SearchParams,
): Promise<SearchResponseDto> {
  const rows = await searchCanonicalBooks(prisma, params.q);

  // Pair each mapped DTO with its source row so `newest` can sort on
  // `createdAt` without adding that field to the public SearchItemDto.
  const pairs: { item: SearchItemDto; row: CanonicalBookRow }[] = [];
  for (const row of rows) {
    const item = toSearchItem(row);
    if (item !== null) {
      pairs.push({ item, row });
    }
  }

  let items: SearchItemDto[];
  if (params.sort === 'popular') {
    const counts = await findWishlistCountsForBooks(
      prisma,
      pairs.map((p) => p.item.id),
    );
    items = pairs
      .sort((a, b) => {
        const countDiff = (counts.get(b.item.id) ?? 0) - (counts.get(a.item.id) ?? 0);
        if (countDiff !== 0) return countDiff;
        const priceDiff = a.item.lowestPrice.amount - b.item.lowestPrice.amount;
        if (priceDiff !== 0) return priceDiff;
        return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
      })
      .map((p) => p.item);
  } else if (params.sort === 'newest') {
    items = pairs
      .sort((a, b) => {
        const dateDiff = b.row.createdAt.getTime() - a.row.createdAt.getTime();
        if (dateDiff !== 0) return dateDiff;
        const priceDiff = a.item.lowestPrice.amount - b.item.lowestPrice.amount;
        if (priceDiff !== 0) return priceDiff;
        return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
      })
      .map((p) => p.item);
  } else {
    items = pairs
      .sort((a, b) => a.item.lowestPrice.amount - b.item.lowestPrice.amount)
      .map((p) => p.item);
  }

  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / params.pageSize);
  const start = (params.page - 1) * params.pageSize;
  const pageItems = items.slice(start, start + params.pageSize);

  return {
    items: pageItems,
    page: params.page,
    pageSize: params.pageSize,
    totalItems,
    totalPages,
  };
}
