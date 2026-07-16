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

/**
 * Parse `--provider=<name>` from CLI args — restrict a run to a single
 * provider. Absent flag → `undefined` (every registered provider runs, the
 * pre-existing behavior). An unrecognised name is a hard error (strict
 * validation, same rationale as `parseModeArg`): a typo here should not
 * silently run every provider or silently run nothing.
 *
 * `validNames` comes from the runtime provider registry (not hardcoded here)
 * so this stays a pure, dependency-free, unit-testable function.
 */
export function parseProviderArg(argv: readonly string[], validNames: readonly string[]): string | undefined {
  const arg = argv.find((a) => a.startsWith('--provider='));
  if (arg === undefined) {
    return undefined;
  }
  const value = arg.slice('--provider='.length);
  if (validNames.includes(value)) {
    return value;
  }
  throw new Error(`Invalid --provider value '${value}' — expected one of: ${validNames.join(', ')}`);
}

/**
 * Parse `--force-provider=<name>` from CLI args — the explicit override that
 * runs a single provider even if it is currently listed in
 * `SCRAPE_DISABLED_PROVIDERS` (provider-enable-disable PRD §2.2). Absent flag
 * → `undefined` (no override in effect). An unrecognised name is a hard error,
 * same strict-validation rationale as `parseProviderArg` — a typo here should
 * not silently start every provider or none.
 *
 * `run-scrape.ts` is responsible for rejecting `--provider=` and
 * `--force-provider=` used together (mutually exclusive) — this function only
 * parses its own flag and knows nothing about `--provider=`.
 */
export function parseForceProviderArg(argv: readonly string[], validNames: readonly string[]): string | undefined {
  const arg = argv.find((a) => a.startsWith('--force-provider='));
  if (arg === undefined) {
    return undefined;
  }
  const value = arg.slice('--force-provider='.length);
  if (validNames.includes(value)) {
    return value;
  }
  throw new Error(`Invalid --force-provider value '${value}' — expected one of: ${validNames.join(', ')}`);
}
