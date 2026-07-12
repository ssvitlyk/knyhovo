/**
 * Strict boolean parse for `GENRE_ASSIGN_AFTER_SCRAPE` (genres-taxonomy PRD G5).
 *
 * Stricter than `scrape-env.ts`'s `SCRAPE_ENRICH_DESCRIPTIONS` (which also
 * accepts `'1'`): only the exact string `'true'` enables the post-scrape
 * genre-assignment hook. Absent, `'false'`, or any other value is disabled.
 * Pure function — no `process` access — so it stays unit-testable.
 */
export function isGenreAssignAfterScrapeEnabled(env: NodeJS.ProcessEnv): boolean {
  return env['GENRE_ASSIGN_AFTER_SCRAPE'] === 'true';
}
