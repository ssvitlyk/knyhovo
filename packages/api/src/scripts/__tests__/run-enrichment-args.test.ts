import { describe, it, expect } from 'vitest';
import { parseEnrichmentArgs } from '../run-enrichment-args.js';

describe('parseEnrichmentArgs', () => {
  it('ignores the bare `--` separator pnpm forwards into argv', () => {
    expect(parseEnrichmentArgs(['--', '--provider=megakniga'])).toEqual({
      provider: 'megakniga',
      batchSize: null,
      limit: null,
    });
  });

  it('parses a bare --provider with defaults for everything else', () => {
    expect(parseEnrichmentArgs(['--provider=megakniga'])).toEqual({
      provider: 'megakniga',
      batchSize: null,
      limit: null,
    });
  });

  it('parses --batch-size and --limit as positive integers', () => {
    expect(
      parseEnrichmentArgs(['--provider=megakniga', '--batch-size=25', '--limit=100']),
    ).toEqual({ provider: 'megakniga', batchSize: 25, limit: 100 });
  });

  it('last-one-wins for repeated value flags', () => {
    expect(
      parseEnrichmentArgs(['--provider=vivat', '--provider=megakniga', '--limit=5', '--limit=9']),
    ).toEqual({ provider: 'megakniga', batchSize: null, limit: 9 });
  });

  it('throws when --provider is missing', () => {
    expect(() => parseEnrichmentArgs([])).toThrow(/--provider is required/);
    expect(() => parseEnrichmentArgs(['--batch-size=10'])).toThrow(/--provider is required/);
  });

  it('throws on an empty --provider value', () => {
    expect(() => parseEnrichmentArgs(['--provider='])).toThrow(/non-empty provider name/);
  });

  it.each([
    ['--batch-size=0'],
    ['--batch-size=-5'],
    ['--batch-size=abc'],
    ['--batch-size=1.5'],
    ['--batch-size='],
  ])('rejects invalid batch size %s', (token) => {
    expect(() => parseEnrichmentArgs(['--provider=megakniga', token])).toThrow(
      /--batch-size must be a positive integer/,
    );
  });

  it.each([['--limit=0'], ['--limit=-1'], ['--limit=x'], ['--limit=']])(
    'rejects invalid limit %s',
    (token) => {
      expect(() => parseEnrichmentArgs(['--provider=megakniga', token])).toThrow(
        /--limit must be a positive integer/,
      );
    },
  );

  it('fails loudly on an unknown flag instead of ignoring it', () => {
    expect(() => parseEnrichmentArgs(['--provider=megakniga', '--dry-run'])).toThrow(
      /unknown argument "--dry-run"/,
    );
    expect(() => parseEnrichmentArgs(['--provider=megakniga', 'megakniga'])).toThrow(
      /unknown argument "megakniga"/,
    );
  });
});
