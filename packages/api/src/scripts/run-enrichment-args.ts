/**
 * Argument parsing for the `scrape:enrich` CLI (megakniga-resumable-enrichment
 * PRD §4.9, PR1).
 *
 * Pure function — no IO, no `process` access — mirroring
 * `genre-backfill-args.ts`: the CLI entrypoint owns all side effects, this
 * module only turns `argv` tokens into a validated options object and throws
 * a descriptive error on anything unrecognised (an ops tool must fail loudly
 * on a typo, not silently run a full 27k pass with a misspelled flag).
 *
 * Provider validity (must have `enrichmentMode: 'background'` wiring) is NOT
 * checked here — the engine owns that check against `ENRICHMENT_PROVIDERS`,
 * so the parser stays free of provider knowledge.
 */

export interface EnrichmentArgs {
  /** Target provider slug (required). */
  readonly provider: string;
  /** Listings per batch; null = fall back to SCRAPE_ENRICH_BATCH_SIZE / default 50. */
  readonly batchSize: number | null;
  /** Stop after processing this many listings (smoke/canary); null = no limit. */
  readonly limit: number | null;
}

export const ENRICHMENT_USAGE = `usage: pnpm --filter @knyhovo/api scrape:enrich -- --provider=<name> [flags]

  --provider=<name>     required; a provider with background enrichment wiring (v1: megakniga)
  --batch-size=<n>      listings per batch (default: SCRAPE_ENRICH_BATCH_SIZE or 50)
  --limit=<n>           process at most N listings, then stop (smoke/canary runs)`;

function parsePositiveInt(flag: string, raw: string): number {
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`scrape:enrich: ${flag} must be a positive integer, got "${raw}"`);
  }
  return Number(raw);
}

/**
 * Parse `argv` (already stripped of the node/script prefix, i.e.
 * `process.argv.slice(2)`) into {@link EnrichmentArgs}. Throws on an unknown
 * flag, an invalid value, or a missing `--provider`. Repeated value flags
 * follow last-one-wins.
 */
export function parseEnrichmentArgs(argv: readonly string[]): EnrichmentArgs {
  let provider: string | null = null;
  let batchSize: number | null = null;
  let limit: number | null = null;

  for (const token of argv) {
    // pnpm forwards a literal `--` separator into argv depending on the
    // invocation form; both `scrape:enrich -- --provider=x` and
    // `scrape:enrich --provider=x` must work.
    if (token === '--') {
      continue;
    }
    if (token.startsWith('--provider=')) {
      const raw = token.slice('--provider='.length);
      if (raw === '') {
        throw new Error('scrape:enrich: --provider= requires a non-empty provider name');
      }
      provider = raw;
      continue;
    }
    if (token.startsWith('--batch-size=')) {
      batchSize = parsePositiveInt('--batch-size', token.slice('--batch-size='.length));
      continue;
    }
    if (token.startsWith('--limit=')) {
      limit = parsePositiveInt('--limit', token.slice('--limit='.length));
      continue;
    }
    throw new Error(`scrape:enrich: unknown argument "${token}"\n${ENRICHMENT_USAGE}`);
  }

  if (provider === null) {
    throw new Error(`scrape:enrich: --provider is required\n${ENRICHMENT_USAGE}`);
  }

  return { provider, batchSize, limit };
}
