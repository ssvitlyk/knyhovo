import type { PrismaClient } from '@prisma/client';
import type { BookDetailsDto } from './dto.js';
import { findCanonicalBookById } from './repository.js';
import { toBookDetails } from './mapper.js';
import { BookNotFoundError } from '../errors.js';

/**
 * Fetch a canonical book by id and return its full details DTO.
 *
 * Throws {@link BookNotFoundError} (→ HTTP 404) when no book with the given
 * id exists. All aggregation logic lives in the mapper, not here.
 */
export async function getBookDetails(prisma: PrismaClient, id: string): Promise<BookDetailsDto> {
  const row = await findCanonicalBookById(prisma, id);
  if (!row) {
    throw new BookNotFoundError();
  }
  return toBookDetails(row);
}
