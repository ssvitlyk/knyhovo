import { describe, it, expect } from 'vitest';
import { hashCode, hashToken, safeCompare, generateCode, generateToken } from '../crypto.js';

describe('hashCode', () => {
  it('is deterministic for the same input and secret', () => {
    const h1 = hashCode('123456', 'my-secret');
    const h2 = hashCode('123456', 'my-secret');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different codes', () => {
    expect(hashCode('123456', 'secret')).not.toBe(hashCode('654321', 'secret'));
  });

  it('produces different hashes for different secrets', () => {
    expect(hashCode('123456', 'secret-a')).not.toBe(hashCode('123456', 'secret-b'));
  });

  it('returns a non-empty hex string', () => {
    const h = hashCode('000000', 'test');
    expect(h).toMatch(/^[0-9a-f]+$/);
    expect(h.length).toBe(64); // SHA-256 hex = 64 chars
  });
});

describe('hashToken', () => {
  it('is deterministic', () => {
    const t = 'some-random-token';
    expect(hashToken(t)).toBe(hashToken(t));
  });

  it('returns a 64-char hex string', () => {
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('safeCompare', () => {
  it('returns true for equal hashes', () => {
    const h = hashCode('123456', 'secret');
    expect(safeCompare(h, h)).toBe(true);
  });

  it('returns false for different hashes', () => {
    const h1 = hashCode('123456', 'secret');
    const h2 = hashCode('654321', 'secret');
    expect(safeCompare(h1, h2)).toBe(false);
  });

  it('returns false when lengths differ', () => {
    expect(safeCompare('abc', 'abcd')).toBe(false);
  });
});

describe('generateCode', () => {
  it('returns a 6-character string', () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
  });

  it('contains only digits', () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('zero-pads short numbers', () => {
    // We can't control randomInt, but we verify the contract with a sample
    for (let i = 0; i < 20; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe('generateToken', () => {
  it('returns a non-empty string', () => {
    expect(generateToken().length).toBeGreaterThan(0);
  });

  it('produces unique tokens on successive calls', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateToken()));
    expect(tokens.size).toBe(10);
  });
});
