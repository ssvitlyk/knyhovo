/**
 * Parse `COLLECTIONS_MIN_GENRE_BOOK_COUNT` (genres-taxonomy PRD §3.1/§9): the
 * minimum live book count for a taxonomic (genre) collection to be publicly
 * browsable. Absent or invalid values fall back to {@link DEFAULT_MIN_GENRE_BOOK_COUNT}.
 */
export const DEFAULT_MIN_GENRE_BOOK_COUNT = 30;

export function parseMinGenreBookCountFromEnv(env: NodeJS.ProcessEnv): number {
  const raw = env['COLLECTIONS_MIN_GENRE_BOOK_COUNT'];
  if (raw === undefined || !/^\d+$/.test(raw)) return DEFAULT_MIN_GENRE_BOOK_COUNT;
  return Number(raw);
}
