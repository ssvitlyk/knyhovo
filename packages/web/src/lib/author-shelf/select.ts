import type { SearchItemDto } from '@/lib/api/types';
import { formatMoney, providerDisplayName } from '@/lib/format';
import { normalizeQuery } from '@/lib/search/normalize';

export interface AuthorShelfBook {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly price: string;
  readonly store: string | null;
  readonly coverUrl: string | null;
}

export function filterToAuthor(items: readonly SearchItemDto[], author: string): SearchItemDto[] {
  if (!author.trim()) return [];
  const normalizedAuthor = normalizeQuery(author);
  return items.filter(item => normalizeQuery(item.author) === normalizedAuthor);
}

export function mapSearchItemToShelfBook(item: SearchItemDto): AuthorShelfBook {
  return {
    id: item.id,
    title: item.title,
    author: item.author,
    price: formatMoney(item.lowestPrice),
    store: item.providers[0] ? providerDisplayName(item.providers[0].provider) : null,
    coverUrl: item.coverUrl,
  };
}

export interface AuthorShelfSelection {
  readonly show: boolean;
  readonly books: readonly AuthorShelfBook[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly cols: number;
}

export function selectAuthorShelf(args: {
  currentId: string;
  roster: readonly AuthorShelfBook[];
  seriesIds?: readonly string[];
  cap: number;
}): AuthorShelfSelection {
  const { currentId, roster, seriesIds = [], cap } = args;
  const excluded = new Set([currentId, ...seriesIds]);
  // Dedup by id keeping first occurrence, then exclude
  const seen = new Set<string>();
  const filtered = roster.filter(book => {
    if (seen.has(book.id)) return false;
    seen.add(book.id);
    return !excluded.has(book.id);
  });
  const books = filtered.slice(0, cap);
  const total = filtered.length;
  const show = total >= 2;
  const hasMore = total > cap;
  const cols = Math.min(books.length, cap);
  return { show, books, total, hasMore, cols };
}
