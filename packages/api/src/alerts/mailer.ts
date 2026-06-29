/**
 * Alert email transport (W4b). Provider-agnostic port plus a console
 * implementation for dev and a Resend adapter for production.
 *
 * The Resend adapter intentionally depends on a minimal local `EmailSendClient`
 * interface rather than importing the `resend` package directly, so this module
 * compiles without the SDK installed. The concrete `new Resend(apiKey)` (which
 * structurally satisfies `EmailSendClient`) is constructed at the wiring layer.
 */

export interface AlertEmailPayload {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  /** One-click unsubscribe URL, emitted as a List-Unsubscribe header. */
  readonly unsubscribeUrl: string;
}

export type SendResult =
  | { readonly ok: true; readonly messageId: string | null }
  | { readonly ok: false; readonly retryable: boolean; readonly error: string };

export interface AlertMailer {
  sendAlertEmail(payload: AlertEmailPayload): Promise<SendResult>;
}

/** Dev mailer: prints the email to stdout. Sends no real mail. */
export class ConsoleAlertMailer implements AlertMailer {
  async sendAlertEmail(payload: AlertEmailPayload): Promise<SendResult> {
    console.log(`[ConsoleAlertMailer] → ${payload.to}: ${payload.subject}`);
    console.log(payload.text);
    return { ok: true, messageId: null };
  }
}

/** Minimal subset of the Resend SDK surface used by the adapter. */
export interface EmailSendClient {
  readonly emails: {
    send(opts: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
      headers?: Record<string, string>;
    }): Promise<{
      data: { id: string } | null;
      error: { message: string; name?: string } | null;
    }>;
  };
}

/** Resend error names that represent transient conditions worth retrying. */
function isRetryableError(name: string | undefined, message: string): boolean {
  const hay = `${name ?? ''} ${message}`.toLowerCase();
  return (
    hay.includes('rate_limit') ||
    hay.includes('rate limit') ||
    hay.includes('internal') ||
    hay.includes('server_error') ||
    hay.includes('timeout') ||
    hay.includes('network') ||
    hay.includes('econn')
  );
}

export class ResendAlertMailer implements AlertMailer {
  constructor(
    private readonly client: EmailSendClient,
    private readonly from: string,
  ) {}

  async sendAlertEmail(payload: AlertEmailPayload): Promise<SendResult> {
    try {
      const res = await this.client.emails.send({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        headers: { 'List-Unsubscribe': `<${payload.unsubscribeUrl}>` },
      });
      if (res.error) {
        return {
          ok: false,
          retryable: isRetryableError(res.error.name, res.error.message),
          error: res.error.message,
        };
      }
      return { ok: true, messageId: res.data?.id ?? null };
    } catch (err) {
      // Thrown errors (network, etc.) are transient — retry.
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, retryable: true, error: message };
    }
  }
}

/** Test double: records sent payloads and returns a scripted result. */
export class FakeAlertMailer implements AlertMailer {
  readonly sent: AlertEmailPayload[] = [];
  constructor(private readonly result: SendResult = { ok: true, messageId: 'fake-id' }) {}
  async sendAlertEmail(payload: AlertEmailPayload): Promise<SendResult> {
    this.sent.push(payload);
    return this.result;
  }
}
