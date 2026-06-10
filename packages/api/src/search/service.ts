import type { PrismaClient } from '@prisma/client';
import type { SearchParams } from './schema.js';
import type { SearchItemDto, SearchResponseDto } from './dto.js';
import { searchCanonicalBooks } from './repository.js';
import { toSearchItem } from './mapper.js';

/**
 * Execute a book search and assemble the paginated response.
 *
 * Pipeline: query matching books → map to DTOs (dropping books with no priced
 * listings) → sort by ascending lowest price → paginate.
 *
 * NOTE (S8a tradeoff): filtering, sorting and pagination are performed in
 * application code after fetching all query matches. `lowestPrice` is derived
 * across a book's listings, so it can't be expressed as a simple column sort.
 * This is acceptable at MVP volume; this endpoint is explicitly not the final
 * API and can later push these operations into SQL.
 */
export async function search(
  prisma: PrismaClient,
  params: SearchParams,
): Promise<SearchResponseDto> {
  const rows = await searchCanonicalBooks(prisma, params.q);

  const items: SearchItemDto[] = rows
    .map(toSearchItem)
    .filter((item): item is SearchItemDto => item !== null)
    .sort((a, b) => a.lowestPrice.amount - b.lowestPrice.amount);

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
