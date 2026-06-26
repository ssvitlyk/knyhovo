/**
 * Maps a scraper's blocked-state error messages onto a structured signal so
 * callers (e.g. the API run summary) can render an explicit provider status
 * without re-parsing free-form text. The block messages themselves are produced
 * by the provider scrapers; this is the single place that recognises them.
 */
export type ProviderBlockKind = 'cloudflare' | 'http-403';

export interface ProviderBlock {
  readonly kind: ProviderBlockKind;
  /** Short label for a status headline, e.g. "Cloudflare Turnstile" or "HTTP 403". */
  readonly label: string;
  /** Human-readable reason line, e.g. "Cloudflare challenge detected". */
  readonly reason: string;
}

const BLOCK_MATCHERS: ReadonlyArray<{
  readonly kind: ProviderBlockKind;
  readonly test: RegExp;
  readonly label: string;
  readonly reason: string;
}> = [
  // Order matters: a Cloudflare block can also carry a 403, so check it first.
  {
    kind: 'cloudflare',
    test: /cloudflare|turnstile/i,
    label: 'Cloudflare Turnstile',
    reason: 'Cloudflare challenge detected',
  },
  {
    kind: 'http-403',
    test: /\b403\b|forbidden/i,
    label: 'HTTP 403',
    reason: 'HTTP 403 (Anti-bot protection)',
  },
];

/**
 * Scan collected scrape error messages for an anti-bot block. Returns the first
 * matching block (Cloudflare before 403), or null when none look like a block.
 */
export function detectProviderBlock(errors: readonly string[]): ProviderBlock | null {
  for (const error of errors) {
    for (const matcher of BLOCK_MATCHERS) {
      if (matcher.test.test(error)) {
        return { kind: matcher.kind, label: matcher.label, reason: matcher.reason };
      }
    }
  }
  return null;
}
