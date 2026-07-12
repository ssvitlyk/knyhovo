import { describe, expect, it } from 'vitest';
import { withJitOff } from '../db.js';

describe('withJitOff', () => {
  it('adds an options param with jit=off to a bare URL', () => {
    const result = withJitOff('postgresql://u:p@h:5432/db');
    expect(new URL(result).searchParams.get('options')).toBe('-c jit=off');
  });

  it('preserves existing params and adds options', () => {
    const result = withJitOff('postgresql://u:p@h:5432/db?schema=public');
    const parsed = new URL(result);
    expect(parsed.searchParams.get('schema')).toBe('public');
    expect(parsed.searchParams.get('options')).toBe('-c jit=off');
  });

  it('appends jit=off to an existing options value', () => {
    const result = withJitOff(
      'postgresql://u:p@h:5432/db?options=-c%20statement_timeout%3D5000'
    );
    expect(new URL(result).searchParams.get('options')).toBe(
      '-c statement_timeout=5000 -c jit=off'
    );
  });

  it('leaves the URL unchanged when options already sets jit explicitly (jit=on)', () => {
    const input = 'postgresql://u:p@h:5432/db?options=-c%20jit%3Don';
    expect(withJitOff(input)).toBe(input);
  });

  it('leaves the URL unchanged when options already contains a jit-family GUC (jit_above_cost)', () => {
    const input =
      'postgresql://u:p@h:5432/db?options=-c%20jit_above_cost%3D100000';
    expect(withJitOff(input)).toBe(input);
  });

  it('returns non-URL garbage input unchanged', () => {
    expect(withJitOff('not a url')).toBe('not a url');
  });
});
