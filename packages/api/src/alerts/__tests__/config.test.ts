import { describe, it, expect, afterEach } from 'vitest';
import { loadAlertConfig } from '../config.js';

const KEYS = ['RESEND_API_KEY', 'ALERT_FROM_EMAIL', 'ALERT_BASE_URL', 'ALERT_MAX_EMAILS_PER_DAY'] as const;
const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function setEnv(env: Partial<Record<(typeof KEYS)[number], string>>): void {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
}

describe('loadAlertConfig', () => {
  it('uses safe defaults when env is unset (console mailer, no key)', () => {
    setEnv({});
    const cfg = loadAlertConfig();
    expect(cfg.resendApiKey).toBeNull();
    expect(cfg.fromEmail).toBe('Knyhovo <alerts@knyhovo.com>');
    expect(cfg.baseUrl).toBe('https://knyhovo.com');
    expect(cfg.dispatch.maxEmailsPerDay).toBe(20);
    expect(cfg.dispatch.baseUrl).toBe('https://knyhovo.com');
  });

  it('reads overrides and strips a trailing slash from the base URL', () => {
    setEnv({
      RESEND_API_KEY: 're_test',
      ALERT_FROM_EMAIL: 'A <a@b.com>',
      ALERT_BASE_URL: 'https://x.example/',
      ALERT_MAX_EMAILS_PER_DAY: '5',
    });
    const cfg = loadAlertConfig();
    expect(cfg.resendApiKey).toBe('re_test');
    expect(cfg.fromEmail).toBe('A <a@b.com>');
    expect(cfg.baseUrl).toBe('https://x.example');
    expect(cfg.dispatch.maxEmailsPerDay).toBe(5);
  });

  it('falls back to the default cap on an invalid number', () => {
    setEnv({ ALERT_MAX_EMAILS_PER_DAY: 'not-a-number' });
    expect(loadAlertConfig().dispatch.maxEmailsPerDay).toBe(20);
  });
});
