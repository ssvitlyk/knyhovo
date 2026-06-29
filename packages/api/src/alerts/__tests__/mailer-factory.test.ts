import { describe, it, expect } from 'vitest';
import { createAlertMailer } from '../mailer-factory.js';
import { ConsoleAlertMailer, ResendAlertMailer } from '../mailer.js';
import type { AlertConfig } from '../config.js';

function cfg(overrides: Partial<AlertConfig> = {}): AlertConfig {
  return {
    resendApiKey: null,
    fromEmail: 'Knyhovo <alerts@knyhovo.com>',
    baseUrl: 'https://knyhovo.com',
    dispatch: {
      maxAttempts: 4,
      backoffMs: [60_000, 300_000, 1_800_000],
      maxEmailsPerDay: 20,
      rateLimitDeferMs: 3_600_000,
      baseUrl: 'https://knyhovo.com',
      limit: 200,
    },
    ...overrides,
  };
}

describe('createAlertMailer', () => {
  it('returns a ConsoleAlertMailer when no API key is configured', () => {
    expect(createAlertMailer(cfg())).toBeInstanceOf(ConsoleAlertMailer);
  });

  it('returns a ResendAlertMailer when an API key is configured', () => {
    expect(createAlertMailer(cfg({ resendApiKey: 're_test_key' }))).toBeInstanceOf(ResendAlertMailer);
  });
});
