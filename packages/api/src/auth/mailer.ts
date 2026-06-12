/**
 * Mailer abstraction — injected as a dependency so tests can supply a fake.
 * Production wires `ConsoleMailer`; a real provider (e.g. Resend) can be
 * added later by implementing this interface.
 */
export interface Mailer {
  sendLoginCode(email: string, code: string): Promise<void>;
}

/**
 * Development mailer: prints the login code to stdout.
 * Does NOT send any real email.
 */
export class ConsoleMailer implements Mailer {
  async sendLoginCode(email: string, code: string): Promise<void> {
    console.log(`[ConsoleMailer] Login code for ${email}: ${code}`);
  }
}
