import { describe, it, expect } from 'vitest';
import { parseModeArg, parseProviderArg } from '../run-scrape-args.js';

describe('parseModeArg', () => {
  it("defaults to 'full' when --mode is absent", () => {
    expect(parseModeArg([])).toBe('full');
  });

  it("parses --mode=full", () => {
    expect(parseModeArg(['--mode=full'])).toBe('full');
  });

  it("parses --mode=incremental", () => {
    expect(parseModeArg(['--mode=incremental'])).toBe('incremental');
  });

  it('ignores unrelated args and still finds --mode', () => {
    expect(parseModeArg(['--other=1', '--mode=incremental', '--foo'])).toBe('incremental');
  });

  it('throws a clear error for an invalid --mode value', () => {
    expect(() => parseModeArg(['--mode=bogus'])).toThrow(
      /Invalid --mode value 'bogus' — expected 'full' or 'incremental'/,
    );
  });
});

describe('parseProviderArg', () => {
  const validNames = ['yakaboo', 'vivat', 'bookchef'];

  it('returns undefined when --provider is absent', () => {
    expect(parseProviderArg([], validNames)).toBeUndefined();
  });

  it('returns the name when --provider=<valid name>', () => {
    expect(parseProviderArg(['--provider=bookchef'], validNames)).toBe('bookchef');
  });

  it('throws for an unknown provider name, listing the valid ones', () => {
    expect(() => parseProviderArg(['--provider=bogus'], validNames)).toThrow(
      /Invalid --provider value 'bogus' — expected one of: yakaboo, vivat, bookchef/,
    );
  });

  it('coexists with --mode in the same argv', () => {
    const argv = ['--mode=incremental', '--provider=vivat'];
    expect(parseModeArg(argv)).toBe('incremental');
    expect(parseProviderArg(argv, validNames)).toBe('vivat');
  });
});
