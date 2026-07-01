/**
 * Auth mailer factory. The ONLY auth module that imports the `resend` package,
 * mirroring `alerts/mailer-factory.ts`, so the rest of the auth layer stays
 * provider-agnostic. Falls back to `ConsoleMailer` when no API key is set.
 */

import { Resend } from 'resend';
import type { EmailSendClient } from '../alerts/mailer.js';
import { ConsoleMailer, ResendAuthMailer, type Mailer } from './mailer.js';
import type { AuthConfig } from './config.js';

export function createAuthMailer(config: AuthConfig): Mailer {
  if (!config.resendApiKey) {
    return new ConsoleMailer();
  }
  // The Resend client structurally satisfies the EmailSendClient port.
  const client = new Resend(config.resendApiKey) as unknown as EmailSendClient;
  return new ResendAuthMailer(client, config.fromEmail);
}
