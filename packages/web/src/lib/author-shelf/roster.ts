import { searchBooks } from '@/lib/api/search';
import type { AuthorShelfBook } from './select';
import { filterToAuthor, mapSearchItemToShelfBook } from './select';

export const AUTHOR_SHELF_PAGE_SIZE = 50;

export async function getAuthorShelfRoster(author: string): Promise<AuthorShelfBook[]> {
  if (!author.trim()) return [];
  try {
    const res = await searchBooks({ q: author, pageSize: AUTHOR_SHELF_PAGE_SIZE });
    const filtered = filterToAuthor(res.items, author);
    const sorted = [...filtered].sort((a, b) => {
      const diff = a.lowestPrice.amount - b.lowestPrice.amount;
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
    return sorted.map(mapSearchItemToShelfBook);
  } catch {
    return [];
  }
}
