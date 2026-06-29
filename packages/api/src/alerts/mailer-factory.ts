/**
 * Mailer factory (W4b). The ONLY module that imports the `resend` package, so the
 * rest of the alert layer stays provider-agnostic. Returns a ConsoleAlertMailer
 * when no API key is configured.
 */

import { Resend } from 'resend';
import { ConsoleAlertMailer, ResendAlertMailer, type AlertMailer, type EmailSendClient } from './mailer.js';
import type { AlertConfig } from './config.js';

export function createAlertMailer(config: AlertConfig): AlertMailer {
  if (!config.resendApiKey) {
    return new ConsoleAlertMailer();
  }
  // The Resend client structurally satisfies the EmailSendClient port.
  const client = new Resend(config.resendApiKey) as unknown as EmailSendClient;
  return new ResendAlertMailer(client, config.fromEmail);
}
