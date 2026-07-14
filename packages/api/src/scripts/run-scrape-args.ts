/**
 * Parse `--mode=full|incremental` from CLI args (bookchef-incremental-scraping
 * PRD §5). Defaults to `'full'` when the flag is absent. An `--mode=` flag
 * with an unrecognised value is a hard error (strict validation) rather than
 * a silent fallback, since a typo here would otherwise silently run full mode
 * or vice versa without anyone noticing.
 *
 * Kept in its own module (not inline in `run-scrape.ts`) so it can be unit
 * tested without importing the CLI entrypoint — `run-scrape.ts` calls `main()`
 * as a side effect at module scope.
 */
export function parseModeArg(argv: readonly string[]): 'full' | 'incremental' {
  const arg = argv.find((a) => a.startsWith('--mode='));
  if (arg === undefined) {
    return 'full';
  }
  const value = arg.slice('--mode='.length);
  if (value === 'full' || value === 'incremental') {
    return value;
  }
  throw new Error(`Invalid --mode value '${value}' — expected 'full' or 'incremental'`);
}
