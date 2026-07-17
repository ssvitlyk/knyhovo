import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadAuthConfig, parseAllowedEmails } from '../config.js';

describe('parseAllowedEmails', () => {
  it('returns null when the variable is unset', () => {
    expect(parseAllowedEmails(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseAllowedEmails('')).toBeNull();
  });

  it('returns null when the list contains only blanks/commas', () => {
    expect(parseAllowedEmails(' , ,, ')).toBeNull();
  });

  it('parses a single email', () => {
    expect(parseAllowedEmails('owner@example.com')).toEqual(new Set(['owner@example.com']));
  });

  it('trims, lowercases, and skips blank entries', () => {
    expect(parseAllowedEmails(' Owner@Example.COM , second@example.com ,, ')).toEqual(
      new Set(['owner@example.com', 'second@example.com']),
    );
  });
});

describe('loadAuthConfig — allowedEmails wiring', () => {
  const ORIGINAL_SECRET = process.env['AUTH_SECRET'];
  const ORIGINAL_ALLOWED = process.env['AUTH_ALLOWED_EMAILS'];

  beforeEach(() => {
    process.env['AUTH_SECRET'] = 'test-secret';
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env['AUTH_SECRET'];
    else process.env['AUTH_SECRET'] = ORIGINAL_SECRET;
    if (ORIGINAL_ALLOWED === undefined) delete process.env['AUTH_ALLOWED_EMAILS'];
    else process.env['AUTH_ALLOWED_EMAILS'] = ORIGINAL_ALLOWED;
  });

  it('is null when AUTH_ALLOWED_EMAILS is unset (allow all)', () => {
    delete process.env['AUTH_ALLOWED_EMAILS'];
    expect(loadAuthConfig().allowedEmails).toBeNull();
  });

  it('is a lowercased set when AUTH_ALLOWED_EMAILS is set', () => {
    process.env['AUTH_ALLOWED_EMAILS'] = 'A@b.com, c@d.com';
    expect(loadAuthConfig().allowedEmails).toEqual(new Set(['a@b.com', 'c@d.com']));
  });
});
