/**
 * Pieces shared by the alert and auth email templates/config: the rendered
 * email shape, HTML escaping, UAH formatting and the Resend env settings.
 */

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** Escape the characters that are significant in HTML text and double-quoted attributes. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format копійки as a UAH string, e.g. 34999 → "349,99 ₴". */
export function formatUah(amount: number): string {
  const hryvnia = Math.floor(amount / 100);
  const kopecks = Math.abs(amount % 100);
  return `${hryvnia},${kopecks.toString().padStart(2, '0')} ₴`;
}

/** Mail settings read from the environment, shared by alerts and auth. */
export interface EmailEnv {
  /** Resend API key, or null to use the console mailer. */
  readonly resendApiKey: string | null;
  /** RFC5322 From address, e.g. "Knyhovo <alerts@knyhovo.com>". */
  readonly fromEmail: string;
  /** Public base URL used to build links (no trailing slash). */
  readonly baseUrl: string;
}

/** Read `RESEND_API_KEY` / `ALERT_FROM_EMAIL` / `ALERT_BASE_URL` with their defaults. */
export function loadEmailEnv(): EmailEnv {
  return {
    resendApiKey: process.env['RESEND_API_KEY']?.trim() || null,
    fromEmail: process.env['ALERT_FROM_EMAIL']?.trim() || 'Knyhovo <alerts@knyhovo.com>',
    baseUrl: (process.env['ALERT_BASE_URL']?.trim() || 'https://knyhovo.com').replace(/\/$/, ''),
  };
}
