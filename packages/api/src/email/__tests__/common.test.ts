import { describe, it, expect, afterEach, vi } from 'vitest';
import { escapeHtml, formatUah, loadEmailEnv } from '../common.js';

describe('escapeHtml', () => {
  it('escapes &, <, > and double quotes', () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
  it('escapes ampersands first (no double escaping of its own output)', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
  it('leaves plain text untouched', () => {
    expect(escapeHtml('Кобзар')).toBe('Кобзар');
  });
});

describe('formatUah', () => {
  it('formats kopecks as hryvnia with a comma', () => {
    expect(formatUah(34999)).toBe('349,99 ₴');
    expect(formatUah(500)).toBe('5,00 ₴');
    expect(formatUah(5)).toBe('0,05 ₴');
  });
});

describe('loadEmailEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses defaults when env is unset or blank', () => {
    vi.stubEnv('RESEND_API_KEY', '  ');
    vi.stubEnv('ALERT_FROM_EMAIL', '');
    vi.stubEnv('ALERT_BASE_URL', '');
    expect(loadEmailEnv()).toEqual({
      resendApiKey: null,
      fromEmail: 'Knyhovo <alerts@knyhovo.com>',
      baseUrl: 'https://knyhovo.com',
    });
  });

  it('trims values and strips one trailing slash from the base url', () => {
    vi.stubEnv('RESEND_API_KEY', ' key ');
    vi.stubEnv('ALERT_FROM_EMAIL', ' K <a@b.c> ');
    vi.stubEnv('ALERT_BASE_URL', ' https://x.test/ ');
    expect(loadEmailEnv()).toEqual({ resendApiKey: 'key', fromEmail: 'K <a@b.c>', baseUrl: 'https://x.test' });
  });
});
