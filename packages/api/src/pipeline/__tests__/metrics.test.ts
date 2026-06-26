import { describe, it, expect } from 'vitest';
import { createMetrics, formatSummary, deriveProviderStatus } from '../metrics.js';
import type { ScrapeMetrics } from '../types.js';

function metricsWith(overrides: Partial<ScrapeMetrics> = {}): ScrapeMetrics {
  return { ...createMetrics(), ...overrides };
}

describe('deriveProviderStatus', () => {
  it('OK when listings were scraped and no errors', () => {
    const s = deriveProviderStatus(metricsWith({ scraped: 1200 }), []);
    expect(s.status).toBe('OK');
    expect(s.headline).toBe('OK');
    expect(s.reason).toBeNull();
  });

  it('BLOCKED (HTTP 403) when a 403 anti-bot error is present', () => {
    const s = deriveProviderStatus(metricsWith({ scraped: 0 }), [
      'Yakaboo blocked by HTTP 403, likely anti-bot protection',
    ]);
    expect(s.status).toBe('BLOCKED');
    expect(s.headline).toBe('BLOCKED (HTTP 403)');
    expect(s.reason).toBe('HTTP 403 (Anti-bot protection)');
  });

  it('BLOCKED (Cloudflare Turnstile) when a Cloudflare error is present', () => {
    const s = deriveProviderStatus(metricsWith({ scraped: 0 }), [
      'BookYe blocked by Cloudflare Turnstile/challenge',
    ]);
    expect(s.status).toBe('BLOCKED');
    expect(s.headline).toBe('BLOCKED (Cloudflare Turnstile)');
    expect(s.reason).toBe('Cloudflare challenge detected');
  });

  it('FAILED when nothing scraped and a non-block error occurred', () => {
    const s = deriveProviderStatus(metricsWith({ scraped: 0 }), [
      'Page 1: network error — ECONNREFUSED',
    ]);
    expect(s.status).toBe('FAILED');
    expect(s.headline).toBe('FAILED');
    expect(s.reason).toContain('ECONNREFUSED');
  });

  it('OK when listings scraped despite a few per-listing errors', () => {
    const s = deriveProviderStatus(metricsWith({ scraped: 100, errors: 2 }), []);
    expect(s.status).toBe('OK');
  });
});

describe('formatSummary', () => {
  it('prints the Status line before the statistics', () => {
    const out = formatSummary('vivat', metricsWith({ scraped: 1200 }), []);
    expect(out).toContain('Status: OK');
    expect(out.indexOf('Status:')).toBeLessThan(out.indexOf('Scraped:'));
  });

  it('renders a BLOCKED status and Reason block for a 403', () => {
    const out = formatSummary('yakaboo', metricsWith({ scraped: 0 }), [
      'Yakaboo blocked by HTTP 403, likely anti-bot protection',
    ]);
    expect(out).toContain('Status: BLOCKED (HTTP 403)');
    expect(out).toContain('Reason:');
    expect(out).toContain('HTTP 403 (Anti-bot protection)');
  });

  it('renders a BLOCKED status for a Cloudflare challenge', () => {
    const out = formatSummary('book-ye', metricsWith({ scraped: 0 }), [
      'BookYe blocked by Cloudflare Turnstile/challenge',
    ]);
    expect(out).toContain('Status: BLOCKED (Cloudflare Turnstile)');
    expect(out).toContain('Cloudflare challenge detected');
  });

  it('omits the Reason block when status is OK', () => {
    const out = formatSummary('vivat', metricsWith({ scraped: 10 }), []);
    expect(out).not.toContain('Reason:');
  });
});
