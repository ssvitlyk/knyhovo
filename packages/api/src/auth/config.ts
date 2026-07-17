/**
 * Auth configuration. Call `loadAuthConfig()` once at startup; the returned
 * object is then injected wherever it is needed — never imported globally.
 * Throws immediately if `AUTH_SECRET` is missing so the process fails fast.
 *
 * Email / link delivery reuses the existing alert Resend infrastructure env vars
 * (`RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `ALERT_BASE_URL`) so there is a single
 * mail configuration surface.
 */
export interface AuthConfig {
  readonly secret: string;
  readonly cookieSecure: boolean;
  readonly codeTtlMs: number;
  readonly magicLinkTtlMs: number;
  readonly sessionTtlMs: number;
  readonly rateWindowMs: number;
  readonly maxCodesPerWindow: number;
  readonly maxVerifyAttempts: number;
  /** Resend API key, or null to fall back to the console mailer. */
  readonly resendApiKey: string | null;
  /** RFC5322 From address, e.g. "Knyhovo <alerts@knyhovo.com>". */
  readonly fromEmail: string;
  /** Public web origin used to build the clickable magic link (no trailing slash). */
  readonly linkBaseUrl: string;
  /**
   * Email allow-list (lowercased). When non-null, only these addresses may
   * request a login link/code — used to gate access on staging.
   * Null (env unset/empty) means every email is allowed.
   */
  readonly allowedEmails: ReadonlySet<string> | null;
}

/**
 * Parse `AUTH_ALLOWED_EMAILS` — a comma-separated list of email addresses.
 * Entries are trimmed and lowercased; blank entries are ignored.
 * Returns null (allow all) when the variable is unset or contains no entries.
 */
export function parseAllowedEmails(raw: string | undefined): ReadonlySet<string> | null {
  if (!raw) return null;
  const emails = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return emails.length > 0 ? new Set(emails) : null;
}

export function loadAuthConfig(): AuthConfig {
  const secret = process.env['AUTH_SECRET'];
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required but not set.');
  }
  return {
    secret,
    cookieSecure: process.env['NODE_ENV'] === 'production',
    codeTtlMs: 10 * 60_000,
    magicLinkTtlMs: 30 * 60_000,
    sessionTtlMs: 30 * 24 * 60 * 60_000,
    rateWindowMs: 15 * 60_000,
    maxCodesPerWindow: 5,
    maxVerifyAttempts: 5,
    resendApiKey: process.env['RESEND_API_KEY']?.trim() || null,
    fromEmail: process.env['ALERT_FROM_EMAIL']?.trim() || 'Knyhovo <alerts@knyhovo.com>',
    linkBaseUrl: (process.env['ALERT_BASE_URL']?.trim() || 'https://knyhovo.com').replace(/\/$/, ''),
    allowedEmails: parseAllowedEmails(process.env['AUTH_ALLOWED_EMAILS']),
  };
}
