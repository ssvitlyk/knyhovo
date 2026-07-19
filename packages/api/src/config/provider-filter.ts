import type { ProviderName } from '@knyhovo/shared';

/** The full set of registered provider slugs — used to validate `SCRAPE_DISABLED_PROVIDERS` entries. */
const VALID_PROVIDER_NAMES: readonly ProviderName[] = [
  'yakaboo',
  'book-club',
  'vivat',
  'book-ye',
  'bookchef',
  'laboratory',
  'knigoland',
  'megakniga',
];

/**
 * Parse `SCRAPE_DISABLED_PROVIDERS` — the single source of truth for which
 * providers are voluntarily paused across scrape/refresh/health
 * (provider-enable-disable PRD §2.1).
 *
 * Format: comma-separated `ProviderName` slugs (e.g.
 * `SCRAPE_DISABLED_PROVIDERS=bookchef`). Whitespace around each element is
 * trimmed. Empty segments produced by stray/trailing commas are silently
 * skipped — that's just tolerant parsing of formatting noise, not a
 * validation concern. An unrecognised slug, however, is a hard `throw`
 * (same strict-validation philosophy as `parseProviderArg` in
 * `scripts/run-scrape-args.ts`): a typo here must never silently leave a
 * provider "not disabled" when the operator believed it was, or vice versa.
 *
 * Absent or empty env var → empty `Set` (no-op, preserves current behavior).
 * Pure function — no IO, no mutation of `env`.
 */
export function getDisabledProviders(env: NodeJS.ProcessEnv): ReadonlySet<ProviderName> {
  const raw = env['SCRAPE_DISABLED_PROVIDERS'];
  if (raw === undefined || raw.trim() === '') {
    return new Set();
  }

  const slugs = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const disabled = new Set<ProviderName>();
  for (const slug of slugs) {
    if (!VALID_PROVIDER_NAMES.includes(slug as ProviderName)) {
      throw new Error(
        `Invalid SCRAPE_DISABLED_PROVIDERS entry '${slug}' — expected one of: ${VALID_PROVIDER_NAMES.join(', ')}`,
      );
    }
    disabled.add(slug as ProviderName);
  }

  return disabled;
}
