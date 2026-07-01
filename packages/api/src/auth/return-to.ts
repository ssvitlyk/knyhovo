/**
 * Validation + construction helpers for post-login redirect targets.
 *
 * `returnTo` is fully attacker-controlled (it travels through the email link),
 * so it MUST be constrained to an internal path to avoid open-redirect attacks.
 * The rule is intentionally strict: a single leading slash, no scheme, no host,
 * no protocol-relative `//`, no backslash tricks, no control characters.
 */

const MAX_RETURN_TO_LENGTH = 2048;

/** True only for safe, internal, same-origin paths like `/wishlist?x=1#y`. */
export function isSafeReturnTo(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  if (path.length === 0 || path.length > MAX_RETURN_TO_LENGTH) return false;
  // Must be an absolute internal path.
  if (!path.startsWith('/')) return false;
  // Reject protocol-relative ("//host") and backslash variants ("/\\host").
  if (path.startsWith('//') || path.startsWith('/\\')) return false;
  // Reject anything that smells like an absolute URL.
  if (path.includes('://')) return false;
  // Reject control chars / whitespace that browsers may normalise into a host.
  if (/[\s\\]/.test(path)) return false;
  return true;
}

/** Return `path` if it is a safe internal path, otherwise `null`. */
export function sanitizeReturnTo(path: unknown): string | null {
  return isSafeReturnTo(path) ? path : null;
}

/**
 * Build the clickable magic-link URL that lands on the web app's verify route.
 * `baseUrl` is the public web origin (e.g. https://knyhovo.com), without a
 * trailing slash. The token is base64url (URL-safe) but encoded defensively.
 */
export function buildMagicLinkUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}`;
}
