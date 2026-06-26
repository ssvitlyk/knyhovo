/**
 * Shared blocked-page detection.
 *
 * A scraper can fetch a page successfully (HTTP 200) yet receive an anti-bot
 * interstitial instead of real content — most commonly a Cloudflare JS/Turnstile
 * challenge, or a "403 Forbidden" body. These helpers classify such pages from
 * their HTML so a provider that returns 0 listings can report *why* (an explicit
 * blocked state) instead of silently looking like an empty catalog.
 *
 * Detection is best-effort string matching: it never throws and never bypasses
 * or solves a challenge — it only labels what was returned.
 */

export type BlockedPageReason =
  | 'cloudflare-challenge'
  | 'forbidden'
  | 'empty-catalog'
  | 'unknown';

const CLOUDFLARE_MARKERS = [
  'cf-challenge',
  'cf_chl_opt',
  'cf-browser-verification',
  '/cdn-cgi/challenge-platform/',
  'challenges.cloudflare.com',
  'turnstile',
  'just a moment',
  'checking your browser before accessing',
  'enable javascript and cookies to continue',
  'attention required! | cloudflare',
];

/** True when the HTML looks like a Cloudflare JS/Turnstile challenge interstitial. */
export function isCloudflareChallenge(html: string): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  return CLOUDFLARE_MARKERS.some((marker) => lower.includes(marker));
}

const FORBIDDEN_MARKERS = [
  'http 403',
  'error 403',
  '403 forbidden',
  'access denied',
  "you don't have permission to access",
  'request blocked',
];

/** True when the HTML looks like an HTTP 403 / access-denied page. */
export function isForbiddenPage(html: string): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  return FORBIDDEN_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * True when the page carries no visible content — a blank/whitespace-only
 * response, or a document whose body strips down to nothing. This is the benign
 * "end of pagination / nothing found" case, distinct from an anti-bot block.
 */
export function isEmptyCatalogPage(html: string): boolean {
  if (html.trim().length === 0) return true;
  const text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length === 0;
}

/**
 * Classify a page's HTML. Order matters: an anti-bot interstitial is often also
 * "empty" of catalog content, so the block reasons are checked before empty.
 */
export function classifyBlockedPage(html: string): BlockedPageReason {
  if (isCloudflareChallenge(html)) return 'cloudflare-challenge';
  if (isForbiddenPage(html)) return 'forbidden';
  if (isEmptyCatalogPage(html)) return 'empty-catalog';
  return 'unknown';
}

/**
 * True when a thrown fetch error looks like an HTTP 403 (Forbidden) response —
 * the signal of likely anti-bot protection at the network layer (the body never
 * reaches us, so {@link isForbiddenPage} cannot see it).
 */
export function isForbiddenError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b403\b/.test(message) || /forbidden/i.test(message);
}
