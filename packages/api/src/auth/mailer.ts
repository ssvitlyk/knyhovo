import type { EmailSendClient } from '../alerts/mailer.js';
import { renderMagicLinkEmail, renderLoginCodeEmail } from './templates.js';

/**
 * Mailer abstraction — injected as a dependency so tests can supply a fake.
 *
 * Production wires `ResendAuthMailer` (reusing the shared Resend `EmailSendClient`
 * port from the alert layer); local/dev falls back to `ConsoleMailer` when no
 * `RESEND_API_KEY` is configured.
 *
 * - `sendMagicLink` — primary web flow (clickable login link).
 * - `sendLoginCode` — legacy/dev OTP flow (`/api/auth/request-code`).
 */
export interface Mailer {
  sendMagicLink(email: string, url: string): Promise<void>;
  sendLoginCode(email: string, code: string): Promise<void>;
}

/**
 * Development mailer: prints the magic link / login code to stdout.
 * Does NOT send any real email.
 */
export class ConsoleMailer implements Mailer {
  async sendMagicLink(email: string, url: string): Promise<void> {
    console.log(`[ConsoleMailer] Magic link for ${email}: ${url}`);
  }

  async sendLoginCode(email: string, code: string): Promise<void> {
    console.log(`[ConsoleMailer] Login code for ${email}: ${code}`);
  }
}

/**
 * Production mailer backed by Resend. Reuses the minimal `EmailSendClient` port
 * defined in the alert layer so this module compiles without importing the
 * `resend` package directly — the concrete client is built in the factory.
 *
 * Throws on send failure so the route surfaces a 500 (the caller already
 * upserts the user, so there is no account-enumeration signal in the response).
 */
export class ResendAuthMailer implements Mailer {
  constructor(
    private readonly client: EmailSendClient,
    private readonly from: string,
  ) {}

  async sendMagicLink(email: string, url: string): Promise<void> {
    const { subject, html, text } = renderMagicLinkEmail({ url });
    await this.send(email, subject, html, text);
  }

  async sendLoginCode(email: string, code: string): Promise<void> {
    const { subject, html, text } = renderLoginCodeEmail({ code });
    await this.send(email, subject, html, text);
  }

  private async send(to: string, subject: string, html: string, text: string): Promise<void> {
    const res = await this.client.emails.send({ from: this.from, to, subject, html, text });
    if (res.error) {
      throw new Error(`Auth email send failed: ${res.error.message}`);
    }
  }
}
