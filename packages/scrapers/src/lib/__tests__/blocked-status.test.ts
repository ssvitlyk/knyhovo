import { describe, it, expect } from 'vitest';
import { detectProviderBlock } from '../blocked-status.js';

describe('detectProviderBlock', () => {
  it('returns null when there are no errors', () => {
    expect(detectProviderBlock([])).toBeNull();
  });

  it('returns null for ordinary network errors', () => {
    expect(detectProviderBlock(['Page 1: network error — ECONNREFUSED'])).toBeNull();
  });

  it('detects an HTTP 403 anti-bot block', () => {
    const block = detectProviderBlock(['Yakaboo blocked by HTTP 403, likely anti-bot protection']);
    expect(block).toEqual({
      kind: 'http-403',
      label: 'HTTP 403',
      reason: 'HTTP 403 (Anti-bot protection)',
    });
  });

  it('detects a Cloudflare/Turnstile block', () => {
    const block = detectProviderBlock(['BookYe blocked by Cloudflare Turnstile/challenge']);
    expect(block).toEqual({
      kind: 'cloudflare',
      label: 'Cloudflare Turnstile',
      reason: 'Cloudflare challenge detected',
    });
  });

  it('prefers Cloudflare over 403 when both markers are present', () => {
    const block = detectProviderBlock(['blocked by Cloudflare challenge after HTTP 403']);
    expect(block?.kind).toBe('cloudflare');
  });

  it('returns the first matching block across multiple messages', () => {
    const block = detectProviderBlock([
      'parse warn',
      'Yakaboo blocked by HTTP 403, likely anti-bot protection',
    ]);
    expect(block?.kind).toBe('http-403');
  });
});
