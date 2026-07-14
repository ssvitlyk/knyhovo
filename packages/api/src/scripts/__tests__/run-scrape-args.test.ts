import { describe, it, expect } from 'vitest';
import { parseModeArg } from '../run-scrape-args.js';

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
