import { describe, it, expect } from 'vitest';
import { createAuthMailer } from '../mailer-factory.js';
import { ConsoleMailer, ResendAuthMailer } from '../mailer.js';
import type { AuthConfig } from '../config.js';

function cfg(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    secret: 'test-secret',
    cookieSecure: false,
    codeTtlMs: 10 * 60_000,
    magicLinkTtlMs: 30 * 60_000,
    sessionTtlMs: 30 * 24 * 60 * 60_000,
    rateWindowMs: 15 * 60_000,
    maxCodesPerWindow: 5,
    maxVerifyAttempts: 5,
    resendApiKey: null,
    fromEmail: 'Knyhovo <alerts@knyhovo.com>',
    linkBaseUrl: 'https://knyhovo.com',
    ...overrides,
  };
}

describe('createAuthMailer', () => {
  it('returns a ConsoleMailer when no API key is configured', () => {
    expect(createAuthMailer(cfg())).toBeInstanceOf(ConsoleMailer);
  });

  it('returns a ResendAuthMailer when an API key is configured', () => {
    expect(createAuthMailer(cfg({ resendApiKey: 're_test_key' }))).toBeInstanceOf(ResendAuthMailer);
  });
});
