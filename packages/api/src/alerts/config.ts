/**
 * Alert email configuration (W4b). Call `loadAlertConfig()` once at startup and
 * inject the result. When `RESEND_API_KEY` is absent the wiring falls back to the
 * ConsoleAlertMailer, so local/dev runs never send real mail.
 */

import { DEFAULT_DISPATCH_CONFIG, type DispatchConfig } from './dispatch.js';

export interface AlertConfig {
  /** Resend API key, or null to use the console mailer. */
  readonly resendApiKey: string | null;
  /** RFC5322 From address, e.g. "Knyhovo <alerts@knyhovo.com>". */
  readonly fromEmail: string;
  /** Public base URL used to build links (book + unsubscribe). */
  readonly baseUrl: string;
  /** Resolved dispatcher config. */
  readonly dispatch: DispatchConfig;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function loadAlertConfig(): AlertConfig {
  const resendApiKey = process.env['RESEND_API_KEY']?.trim() || null;
  const fromEmail = process.env['ALERT_FROM_EMAIL']?.trim() || 'Knyhovo <alerts@knyhovo.com>';
  const baseUrl = (process.env['ALERT_BASE_URL']?.trim() || 'https://knyhovo.com').replace(/\/$/, '');
  const maxEmailsPerDay = intFromEnv('ALERT_MAX_EMAILS_PER_DAY', DEFAULT_DISPATCH_CONFIG.maxEmailsPerDay);

  return {
    resendApiKey,
    fromEmail,
    baseUrl,
    dispatch: { ...DEFAULT_DISPATCH_CONFIG, baseUrl, maxEmailsPerDay },
  };
}
